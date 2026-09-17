import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    // ⭐ Шаг 100 (P1-8): правило react-refresh требует «файл = только компоненты».
    // Рядом с компонентами живут константы (табы BottomNav), функция getBottomNavConfig
    // и хуки (useAuth, useMobileHeader, useHeaderConfig). Разносить их по отдельным файлам
    // сейчас = переписывать 20+ импортов по проекту, поэтому явно разрешаем КОНКРЕТНЫЕ имена,
    // а не отключаем правило целиком.
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: [
            'ALL_BOTTOM_TABS',   // components/BottomNav.tsx
            'DEFAULT_BOTTOM_TABS',
            'getBottomNavConfig',
            'useAuth',           // contexts/AuthContext.tsx
            'useMobileHeader',   // contexts/MobileHeaderContext.tsx
            'useHeaderConfig',
          ],
        },
      ],
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
