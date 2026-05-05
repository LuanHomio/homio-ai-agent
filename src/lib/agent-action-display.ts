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
    label: 'Follow-up Avançado',
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
