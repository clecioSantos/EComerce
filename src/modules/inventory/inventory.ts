/**
 * Regras de estoque — puras e sem dependência de banco.
 * O estoque sempre pertence a uma variante; nunca a Product diretamente.
 */

export type MovementType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT"
  | "RESERVATION"
  | "RELEASE"
  | "CONSUME"
  | "RESTOCK";

export interface InventoryState {
  quantityOnHand: number;
  quantityReserved: number;
  allowBackorder?: boolean;
}

export interface MovementInput {
  type: MovementType;
  /**
   * Magnitude (IN/OUT/RESERVATION/RELEASE/CONSUME/RESTOCK) ou delta com sinal
   * (ADJUSTMENT).
   */
  quantity: number;
}

export interface MovementResult {
  quantityOnHand: number;
  quantityReserved: number;
  deltaOnHand: number;
  deltaReserved: number;
}

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export function availableQuantity(state: InventoryState): number {
  return state.quantityOnHand - state.quantityReserved;
}

export function canFulfill(state: InventoryState, quantity: number): boolean {
  if (quantity <= 0) return false;
  if (state.allowBackorder) return true;
  return availableQuantity(state) >= quantity;
}

export function applyMovement(
  state: InventoryState,
  movement: MovementInput,
): MovementResult {
  const allowBackorder = state.allowBackorder ?? false;
  const magnitude = Math.abs(movement.quantity);

  let deltaOnHand = 0;
  let deltaReserved = 0;

  switch (movement.type) {
    case "IN":
      deltaOnHand = magnitude;
      break;
    case "OUT":
      deltaOnHand = -magnitude;
      break;
    case "ADJUSTMENT":
      deltaOnHand = movement.quantity;
      break;
    case "RESERVATION":
      deltaReserved = magnitude;
      break;
    case "RELEASE":
      deltaReserved = -magnitude;
      break;
    case "CONSUME":
      // Baixa definitiva de uma reserva ativa: sai do reservado e do físico.
      deltaReserved = -magnitude;
      deltaOnHand = -magnitude;
      break;
    case "RESTOCK":
      // Devolução ao estoque físico (estorno/reembolso de venda concluída).
      deltaOnHand = magnitude;
      break;
    default: {
      const exhaustive: never = movement.type;
      throw new InventoryError(`Tipo de movimento inválido: ${exhaustive}`);
    }
  }

  const quantityOnHand = state.quantityOnHand + deltaOnHand;
  const quantityReserved = state.quantityReserved + deltaReserved;

  if (quantityReserved < 0) {
    throw new InventoryError("Estoque reservado não pode ser negativo.");
  }
  if (!allowBackorder && quantityOnHand < 0) {
    throw new InventoryError(
      "Estoque insuficiente: a quantidade disponível não pode ficar negativa.",
    );
  }
  if (!allowBackorder && quantityReserved > quantityOnHand) {
    throw new InventoryError(
      "Não é possível reservar mais do que a quantidade física em estoque.",
    );
  }

  return { quantityOnHand, quantityReserved, deltaOnHand, deltaReserved };
}
