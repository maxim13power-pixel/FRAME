// frontend/src/components/materials/estimateLayout.ts
// ⭐ №393: размеры нижних панелей сметы в одном месте — их используют и страница,
// и вынесенная «прокруточная» обвязка (плашка итогов, FAB, кнопка «вниз»).

export const BOTTOM_NAV_HEIGHT = 56; // высота BottomNav (MUI BottomNavigation по умолчанию)
export const SUMMARY_BAR_BOTTOM = BOTTOM_NAV_HEIGHT + 8; // плашка над меню с зазором 8px
/** ⭐ №389: отступ списка под фиксированную плашку итогов (подобрал владелец) */
export const SUMMARY_LIST_CLEARANCE_BOTTOM_PX = 65;
