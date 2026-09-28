; O Telando fica na bandeja quando a janela fecha, então o pedido educado de fechar do instalador
; só esconderia o app. Antes de instalar (ou desinstalar), ele é encerrado de verdade.
!macro customCheckAppRunning
  nsExec::Exec `taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}"`
  Sleep 800
!macroend
