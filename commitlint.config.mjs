export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Descrições em pt-BR podem começar com nome próprio ("Electron", "LiveKit").
    'subject-case': [0],
  },
}
