/**
 * The UI layer.
 *
 * Four surfaces that sit over the journey: the gate the visitor arrives at,
 * the ticket they read at a station, the indicator that always says where
 * they are, and the wallet that keeps what they kept.
 *
 * Importing from this file also pulls in the stylesheet, so a consumer never
 * has to remember to add it.
 */

import './ui.css';

export { Gate } from './Gate';
export type { GateProps } from './Gate';

export { Ticket, ticketSerial } from './Ticket';
export type { TicketProps } from './Ticket';

export { Indicator } from './Indicator';
export type { IndicatorProps } from './Indicator';

export { Wallet } from './Wallet';
export type { WalletProps } from './Wallet';
