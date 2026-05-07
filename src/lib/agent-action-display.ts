import type { ActionType } from './types';
import {
  Workflow,
  UserCog,
  CalendarCheck,
  PowerOff,
  UserRoundCheck,
  Clock,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';

export type ActionTypeMeta = {
  type: ActionType;
  label: string;
  description: string;
  icon: LucideIcon;
};

// Ordem segue a UI nativa do GHL Conversation AI (Bot Goals).
export const ACTION_TYPE_META: Record<ActionType, ActionTypeMeta> = {
  triggerWorkflow: {
    type: 'triggerWorkflow',
    label: 'Disparar Workflow',
    description: 'Executa um ou mais workflows do GHL quando a condição casar',
    icon: Workflow,
  },
  updateContactField: {
    type: 'updateContactField',
    label: 'Atualizar Campo do Contato',
    description: 'Coleta um valor na conversa e grava em um custom field',
    icon: UserCog,
  },
  appointmentBooking: {
    type: 'appointmentBooking',
    label: 'Agendar Compromisso',
    description: 'Marca em um calendar do GHL dentro da conversa',
    icon: CalendarCheck,
  },
  stopBot: {
    type: 'stopBot',
    label: 'Parar o Bot',
    description: 'Pausa o agent quando a condição for detectada (ex: despedida)',
    icon: PowerOff,
  },
  humanHandOver: {
    type: 'humanHandOver',
    label: 'Transferir para Humano',
    description: 'Atribui a conversa a um operador humano',
    icon: UserRoundCheck,
  },
  advancedFollowup: {
    type: 'advancedFollowup',
    label: 'Follow-up',
    description: 'Sequência de mensagens quando contato pára de responder',
    icon: Clock,
  },
  transferBot: {
    type: 'transferBot',
    label: 'Transferir para outro Bot',
    description: 'Passa a conversa para outro agent',
    icon: ArrowRightLeft,
  },
};

export const ACTION_TYPE_LIST: ActionTypeMeta[] = [
  ACTION_TYPE_META.triggerWorkflow,
  ACTION_TYPE_META.updateContactField,
  ACTION_TYPE_META.appointmentBooking,
  ACTION_TYPE_META.stopBot,
  ACTION_TYPE_META.humanHandOver,
  ACTION_TYPE_META.advancedFollowup,
  ACTION_TYPE_META.transferBot,
];

// Traducao dos paths tecnicos do schema pra labels amigaveis exibidos
// nas mensagens de erro de validacao. Cobre os 7 forms.
export const FIELD_LABELS: Record<string, string> = {
  // base (form-level)
  name: 'Nome',
  description: 'Descricao',
  // triggerWorkflow
  workflowIds: 'Workflows',
  triggerCondition: 'Condicao de Disparo',
  // updateContactField
  contactFieldId: 'Campo do Contato',
  contactUpdateExamples: 'Exemplos',
  // appointmentBooking
  calendarId: 'Calendar',
  // stopBot
  stopBotDetectionType: 'Tipo de Deteccao',
  stopBotTriggerCondition: 'Condicao de Disparo',
  stopBotExamples: 'Exemplos',
  finalMessage: 'Mensagem Final',
  // humanHandOver
  handoverType: 'Tipo de Handover',
  examples: 'Exemplos',
  assignToUserId: 'Usuario Designado',
  tags: 'Tags',
  skipAssignToUser: 'Pular Atribuicao',
  createTask: 'Criar Task',
  // transferBot
  transferBotType: 'Tipo',
  transferToBot: 'Agent de Destino',
  transferBotTriggerCondition: 'Condicao de Disparo',
  transferBotExamples: 'Exemplos',
  // advancedFollowup
  scenarioId: 'Cenario',
  followupSequence: 'Sequencia de Follow-ups',
  followupTime: 'Tempo',
  followupTimeUnit: 'Unidade',
  aiEnabledMessage: 'Mensagem com IA',
  triggerWorkflow: 'Disparar Workflow',
  // sleep fields (compartilhado)
  reactivateEnabled: 'Reativar Automaticamente',
  sleepTime: 'Tempo de Pausa',
  sleepTimeUnit: 'Unidade de Tempo',
  enabled: 'Ativo',
};

export function formatFieldPath(path: (string | number)[]): string {
  if (path.length === 0) return '(geral)';
  return path
    .map((seg) => {
      if (typeof seg === 'number') return `[${seg + 1}]`;
      return FIELD_LABELS[seg] ?? seg;
    })
    .join(' › ');
}
