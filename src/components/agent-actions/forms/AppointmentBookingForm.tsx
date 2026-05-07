'use client';

import { FieldGroup, FieldLabel, SwitchField } from '../form-fields';
import { GhlSelect } from '../GhlSelect';

export type AppointmentBookingConfig = {
  calendarId: string;
  onlySendLink: boolean;
  triggerWorkflow: boolean;
  sleepAfterBooking: boolean;
  transferBot: boolean;
  rescheduleEnabled: boolean;
  cancelEnabled: boolean;
};

export const appointmentBookingDefaults: AppointmentBookingConfig = {
  calendarId: '',
  onlySendLink: false,
  triggerWorkflow: false,
  sleepAfterBooking: false,
  transferBot: false,
  rescheduleEnabled: true,
  cancelEnabled: true,
};

export function AppointmentBookingForm({
  value,
  onChange,
  locationId,
}: {
  value: AppointmentBookingConfig;
  onChange: (v: AppointmentBookingConfig) => void;
  locationId: string;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup errorField="calendarId">
        <FieldLabel label="Calendar" hint="Calendar do GHL onde o agendamento sera feito" required />
        <GhlSelect
          resource="calendars"
          locationId={locationId}
          value={value.calendarId}
          onChange={(id) => onChange({ ...value, calendarId: id })}
          placeholder="Selecione um calendar..."
        />
      </FieldGroup>

      <div className="space-y-3 pt-2">
        <SwitchField
          label="Apenas enviar o link"
          hint="Se ativo, o bot envia o link do calendar em vez de marcar o horario na conversa"
          checked={value.onlySendLink}
          onChange={(v) => onChange({ ...value, onlySendLink: v })}
        />
        <SwitchField
          label="Disparar workflow apos agendamento"
          checked={value.triggerWorkflow}
          onChange={(v) => onChange({ ...value, triggerWorkflow: v })}
        />
        <SwitchField
          label="Pausar bot apos agendamento"
          checked={value.sleepAfterBooking}
          onChange={(v) => onChange({ ...value, sleepAfterBooking: v })}
        />
        <SwitchField
          label="Transferir para outro bot apos agendamento"
          checked={value.transferBot}
          onChange={(v) => onChange({ ...value, transferBot: v })}
        />
        <SwitchField
          label="Permitir reagendamento"
          checked={value.rescheduleEnabled}
          onChange={(v) => onChange({ ...value, rescheduleEnabled: v })}
        />
        <SwitchField
          label="Permitir cancelamento"
          checked={value.cancelEnabled}
          onChange={(v) => onChange({ ...value, cancelEnabled: v })}
        />
      </div>
    </div>
  );
}
