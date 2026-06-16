import type { Analytics, SensorData } from "../domain/model/analytics.entity";
import { supabase } from "../../utils/supabase";
import { AnalyticsAssembler } from "./assembler/analytics-assembler";
import { withCache, invalidateCached } from "../../experiments/cache/metrics-cache";

const CACHE_ALL_SENSOR_DATA = 'all_sensor_data';
const CACHE_RECENT_AVERAGES = 'recent_averages';

type ServiceResponse<T> = {
    data: T;
};

export class AnalyticsService {
    private wrapResponse<T>(data: T): ServiceResponse<T> {
        return {
            data
        };
    }

    async getAllSensorData(): Promise<ServiceResponse<SensorData[]>> {
        // Fetch all metrics. This query does not require the current user
        // because IoT metrics are general and may have null plant_id.
        // Se cachea en cliente (< 1.5 s en cargas repetidas) con TTL corto.
        const data = await withCache<any[]>(CACHE_ALL_SENSOR_DATA, async () => {
            const { data, error } = await supabase
                .from('plant_metrics')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return data as any[];
        });

        return this.wrapResponse(data);
    }

    async getSensorDataByDevice(deviceId: string): Promise<ServiceResponse<SensorData[]>> {
        if (!deviceId || deviceId === 'undefined' || deviceId === 'null') {
            throw new Error('Invalid deviceId provided to getSensorDataByDevice');
        }
        
        const { data, error } = await supabase
            .from('plant_metrics')
            .select('*')
            .eq('device_id', deviceId)
            .order('timestamp', { ascending: false });

        if (error) throw error;
        return this.wrapResponse(data as any[]);
    }

    async importSensorData(sensorData: Omit<SensorData, 'id'>[]): Promise<ServiceResponse<any>> {
        const formattedData = sensorData.map((d: any) => ({
            plant_id: d.plantId,
            timestamp: d.timestamp || new Date().toISOString(),
            air_humidity_pct: d.airHumidityPct,
            temperature_c: d.temperatureC,
            soil_moisture_pct: d.soilMoisturePct,
            light_level: d.lightLevel,
            device_id: d.deviceId
        }));

        const { data, error } = await supabase
            .from('plant_metrics')
            .insert(formattedData)
            .select();

        if (error) throw error;
        // Nuevas métricas: invalida la caché para forzar lectura fresca.
        invalidateCached(CACHE_ALL_SENSOR_DATA);
        invalidateCached(CACHE_RECENT_AVERAGES);
        return this.wrapResponse(data);
    }

    async getAnalyticsByUser(userId: string): Promise<ServiceResponse<Analytics[]>> {
        if (!userId || userId === 'undefined' || userId === 'null') {
            throw new Error('Invalid userId provided to getAnalyticsByUser');
        }
        
        const res = await this.getAllSensorData();
        const analytics = AnalyticsAssembler.aggregateByUser(res.data, userId);
        return this.wrapResponse(analytics);
    }

    async getAnalyticsByPlant(plantId: number, deviceId?: string): Promise<ServiceResponse<Analytics>> {
        let sensorData: SensorData[];
        
        if (deviceId) {
            const res = await this.getSensorDataByDevice(deviceId);
            sensorData = res.data;
        } else {
            const { data, error } = await supabase
                .from('plant_metrics')
                .select('*')
                .eq('plant_id', plantId)
                .order('timestamp', { ascending: false });
                
            if (error) throw error;
            sensorData = data as any[];
        }
        
        const analytics = AnalyticsAssembler.aggregateByPlant(sensorData, plantId, deviceId);
        return this.wrapResponse(analytics);
    }

    calculateAnalyticsFromMetrics(plantId: number, metrics: any[], deviceId?: string): Analytics {
        return AnalyticsAssembler.fromPlantMetrics(plantId, metrics, deviceId);
    }

    async getRecentAverages(limit: number = 5): Promise<ServiceResponse<any>> {
        const result = await withCache<any>(`${CACHE_RECENT_AVERAGES}_${limit}`, async () => {
        const { data, error } = await supabase
            .from('plant_metrics')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const recentData = data as any[];

        if (recentData.length === 0) {
            return ({
                avgTemperature: 0,
                avgHumidity: 0,
                avgSoilMoisture: 0,
                avgLight: 0,
                minTemperature: 0,
                maxTemperature: 0,
                count: 0,
                period: { start: null, end: null },
                history: []
            });
        }

        const mappedData = recentData.map((d: any) => AnalyticsAssembler.mapSensorData(d));
        const summary = AnalyticsAssembler.calculateSummary(mappedData);
        const dates = recentData.map((d: any) => d.timestamp || d.created_at);

        return ({
            ...summary,
            count: recentData.length,
            period: {
                start: dates[dates.length - 1],
                end: dates[0]
            },
            history: mappedData
        });
        });

        return this.wrapResponse(result);
    }
}

// Singleton instance for convenience and easier mocking in callers
export const analyticsService = new AnalyticsService();
