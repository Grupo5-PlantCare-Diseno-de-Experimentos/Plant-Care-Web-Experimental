<script setup lang="ts">
import type { AiMessage } from '../../domain/model/ai.entity.ts';
import { renderSafeMarkdown } from '../../infrastructure/ai-markdown';

defineProps<{
  messages: readonly AiMessage[];
  streaming: boolean;
}>();

const renderAssistant = (content: string): string => renderSafeMarkdown(content);</script>

<template>
  <div class="ai-message-list" data-testid="ai-message-list">
    <div v-if="messages.length === 0" class="ai-empty">
      <slot name="empty" />
    </div>
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="ai-row"
      :class="msg.role === 'user' ? 'ai-row-user' : 'ai-row-assistant'"
    >
      <div
        class="ai-avatar"
        :class="msg.role === 'user' ? 'ai-avatar-user' : 'ai-avatar-ai'"
        aria-hidden="true"
      >
        <span v-if="msg.role === 'user'">T</span>
        <i v-else class="pi pi-sparkles"></i>
      </div>
      <div
        class="ai-message"
        :class="msg.role === 'user' ? 'ai-message-user' : 'ai-message-assistant'"
      >
        <div class="ai-role">
          <span class="ai-role-dot"></span>{{ msg.role === 'user' ? 'Tú' : 'PlantCare IA' }}
        </div>
        <p v-if="msg.role === 'user'" class="ai-content">{{ msg.content }}</p>
        <div
          v-else
          class="ai-content ai-markdown"
          data-testid="ai-markdown"
          v-html="renderAssistant(msg.content)"
        ></div>
      </div>
    </div>
    <div v-show="streaming" class="ai-typing" data-testid="ai-typing">
      <div class="ai-avatar ai-avatar-ai" aria-hidden="true"><i class="pi pi-sparkles"></i></div>
      <div class="ai-typing-bubble">
        <span class="ai-caret" data-testid="ai-streaming-caret"></span>
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span class="ai-typing-text">Escribiendo…</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-message-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ai-empty {
  color: var(--text-secondary);
}
.ai-row {
  display: flex;
  gap: 0.65rem;
  align-items: flex-end;
  max-width: 92%;
  animation: fadeIn 0.4s ease both;
}
.ai-row-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}
.ai-row-assistant {
  align-self: flex-start;
}
.ai-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: var(--font-weight-bold);
}
.ai-avatar-user {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}
.ai-avatar-ai {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: var(--shadow-green);
  font-size: 0.85rem;
}
.ai-message {
  border-radius: var(--radius-lg);
  padding: 0.85rem 1.05rem;
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.ai-message-user {
  background: var(--gradient-primary);
  color: #fff;
  border-bottom-right-radius: 6px;
}
.ai-message-assistant {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-bottom-left-radius: 6px;
}
.ai-role {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
  opacity: 0.85;
}
.ai-role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.ai-row-user .ai-role {
  justify-content: flex-end;
  color: rgba(255, 255, 255, 0.9);
}
.ai-row-assistant .ai-role {
  color: var(--primary-green);
}
.ai-content {
  margin: 0;
  white-space: pre-wrap;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  word-break: break-word;
}
.ai-markdown > :first-child {
  margin-top: 0;
}
.ai-markdown > :last-child {
  margin-bottom: 0;
}
.ai-markdown :is(h1, h2, h3) {
  margin: 0.6em 0 0.3em;
  letter-spacing: -0.02em;
}
.ai-markdown ul {
  padding-left: 1.2rem;
  margin: 0.4rem 0;
}
.ai-markdown code {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.05rem 0.35rem;
  font-size: 0.82em;
}
.ai-typing {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  align-self: flex-start;
}
.ai-typing-bubble {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 0.55rem 0.9rem;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
.ai-caret,
.ai-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-green);
  animation: ai-bounce 1.2s ease-in-out infinite;
}
.ai-dot:nth-of-type(2) {
  animation-delay: 0.15s;
}
.ai-dot:nth-of-type(3) {
  animation-delay: 0.3s;
}
.ai-typing-text {
  margin-left: 0.3rem;
}
@keyframes ai-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
