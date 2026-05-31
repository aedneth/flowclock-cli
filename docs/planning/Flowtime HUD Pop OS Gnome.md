---
type: resource
created: 2026-04-27
modified: 2026-05-04
tags: [linux, pop-os, gnome, terminal, productividad, flowtime, bash, hud]
status: active
platform: Pop!_OS 22.04
related: ["[[MOC-Tools-and-Resources]]", "[[05-areas/wellbeing]]"]
---

# Flowtime HUD Timer en Pop!_OS GNOME

## 1. PIPELINE COMPLETO DEL PROYECTO

> Reconstrucción técnica real del desarrollo de un cronómetro tipo HUD para Flowtime en Pop!_OS 22.04 con GNOME.

### Fases de desarrollo:

#### Fase 1 — Identificación del problema y definición del objetivo
- **Qué se buscaba construir:** una app o temporizador similar al reloj de Windows, pero más orientado a productividad y Flowtime, capaz de mantenerse visible mientras se trabaja.
- **Requerimientos principales:**
  - Temporizador/crono visible constantemente.
  - Ventana pequeña o flotante.
  - Que no sea afectado por tabs/ventanas de trabajo.
  - Compatible con Linux Pop!_OS 22.04 + GNOME.
  - Preferiblemente no Pomodoro, sino Flowtime: contar tiempo libremente mientras dura el enfoque.
- **Herramientas consideradas:** GNOME Clocks, extensiones GNOME, terminal, tty-clock, termdown, Bash, GNOME Terminal.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 2 — Prueba de GNOME Clocks como solución inicial
- **Qué se probó:** usar GNOME Clocks en modo Stopwatch.
- **Herramientas usadas:** GNOME Clocks.
- **Resultado:** funcional como cronómetro, pero con limitación de diseño: la ventana no podía reducirse lo suficiente para que solo se viera el stopwatch.
- **Conclusión:** GNOME Clocks no era adecuado para un HUD minimalista.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 3 — Prueba de `tty-clock`
- **Qué se probó:** usar `tty-clock` desde terminal como reloj/cronómetro visual.
- **Herramientas usadas:** `tty-clock`, GNOME Terminal.
- **Comandos usados/intentados:**
  ```bash
  tty-clock -s -S
  tty-clock -s -c -f "%H:%M:%S"
  ```
- **Resultado:** `tty-clock` se comportó como reloj del sistema, no como cronómetro Flowtime real.
- **Conclusión:** `tty-clock` no resolvía el requerimiento porque no contaba desde `00:00:00`.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 4 — Prueba de `termdown`
- **Qué se probó:** instalar y usar `termdown` como cronómetro de terminal.
- **Herramientas usadas:** `apt`, `pip3`, `termdown`.
- **Problemas encontrados:**
  - `sudo apt install termdown` falló porque el paquete no estaba en los repositorios de Pop!_OS/Ubuntu 22.04.
  - La versión instalada con pip no reconocía `--count-up`.
- **Comandos relevantes:**
  ```bash
  sudo apt install termdown
  pip3 install --user termdown
  termdown --count-up
  ```
- **Resultado:** no se logró usar `termdown` como count-up confiable en esa versión.
- **Conclusión:** se descartó `termdown` para evitar dependencia externa/versiones inconsistentes.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 5 — Construcción de cronómetro Flowtime en Bash
- **Qué se construyó:** script Bash propio para contar desde `00:00:00`.
- **Herramientas usadas:** Bash, `date`, `printf`, `sleep`, GNOME Terminal.
- **Primera versión funcional:**
  - Contaba hacia arriba.
  - Se podía ejecutar desde terminal.
  - Era independiente de apps externas.
- **Limitación inicial:** visualmente aparecía pequeño, sin centrar y poco estético.
- **Conclusión:** Bash era la base correcta porque daba control total y eliminaba dependencia de paquetes externos.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 6 — Centrado visual y estética HUD
- **Qué se construyó:** versión centrada del script usando dimensiones dinámicas de terminal.
- **Herramientas usadas:** Bash, `tput lines`, `tput cols`, `tput cup`, ANSI escape codes.
- **Mejoras:**
  - Texto centrado.
  - Cursor oculto con `tput civis`.
  - Limpieza de pantalla.
  - Integración visual con perfil personalizado de GNOME Terminal.
- **Problemas nuevos:** al redimensionar demasiado la ventana, el reloj podía desaparecer por cálculos de filas/columnas inválidos.
- **Conclusión:** el centrado dinámico debía tener protecciones anti-resize.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 7 — Personalización de perfil en GNOME Terminal
- **Qué se configuró:** perfil dedicado llamado `Pop Clock`.
- **Herramientas usadas:** GNOME Terminal Preferences.
- **Configuración aplicada/recomendada:**
  - Fuente: JetBrains Mono.
  - Tamaño de fuente probado: 40+, luego reducido hasta 20 por límites de tamaño de ventana.
  - Color de texto: verde/neón.
  - Fondo: oscuro/transparente.
  - Cursor: Underline.
  - Cursor blinking: Disabled.
  - Allow blinking text: Never.
  - Initial terminal size ajustado.
- **Problema:** GNOME Terminal tiene límites mínimos internos de ventana; no puede volverse microscópico aunque el script sea simple.
- **Conclusión:** GNOME Terminal funciona como HUD básico, pero tiene límites estructurales por GTK/header bar.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 8 — Automatización de lanzamiento
- **Qué se intentó:** evitar escribir el comando completo cada vez.
- **Herramientas usadas:** alias de Bash, perfil de GNOME Terminal, launcher `.desktop` como opción.
- **Comando base usado:**
  ```bash
  gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18 -e ./flowtime.sh
  ```
- **Opciones propuestas:**
  - Custom command en el perfil:
    ```bash
    /home/eduardo.borjas/flowtime.sh
    ```
  - Alias:
    ```bash
    alias flowclock='gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18'
    ```
  - Launcher `.desktop`.
- **Resultado:** se discutió que el perfil puede ejecutar el script automáticamente, pero hay que cuidar que no se pierda la funcionalidad interactiva.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 9 — Añadir funcionalidad interactiva
- **Qué se construyó:** controles invisibles desde teclado.
- **Herramientas usadas:** Bash, `stty`, lectura no bloqueante de teclado, `dd`.
- **Controles implementados:**
  - `p`: pausar/reanudar.
  - `r`: reiniciar.
  - `q`: salir.
- **Problema:** al añadir UI extra —recuadro, session count, total today y controles visibles— el diseño se volvió visualmente malo y se rompió en ventana mínima.
- **Conclusión:** para este caso, la funcionalidad debía mantenerse invisible. El HUD debe mostrar solo el tiempo.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

#### Fase 10 — Regreso al modelo ultra minimalista
- **Qué se decidió:** mantener el script como una sola línea visible, con controles invisibles.
- **Herramientas usadas:** Bash, GNOME Terminal.
- **Arquitectura visual final:**
  - Solo muestra `HH:MM:SS`.
  - No muestra caja.
  - No muestra controles.
  - No muestra sesión.
  - No muestra total diario.
  - Mantiene `p`, `r`, `q` como controles ocultos.
- **Motivo:** el objetivo central era un temporizador Flowtime visible, pequeño y limpio, no un dashboard.
- **Tiempo tomado:** DATO NO DISPONIBLE — requiere revisión manual.

### Arquitectura final implementada (si aplica):

```text
Usuario
  ↓
Alias / launcher / comando manual
  ↓
GNOME Terminal con perfil "Pop Clock"
  ↓
Script Bash ~/flowtime.sh
  ↓
Cronómetro Flowtime count-up
  ↓
Renderizado minimalista en terminal:
  - HH:MM:SS centrado
  - Controles invisibles:
    p = pausa/reanuda
    r = reinicia
    q = salir
```

#### Componentes finales
- **Sistema operativo:** Pop!_OS 22.04.
- **Entorno gráfico:** GNOME.
- **Terminal:** GNOME Terminal.
- **Perfil dedicado:** `Pop Clock`.
- **Lenguaje/script:** Bash.
- **Dependencias externas:** ninguna obligatoria.
- **Modo de uso:** Flowtime count-up visible.
- **UI final:** una sola línea centrada.

---

## 2. ERRORES Y BLOCKERS ENCONTRADOS

### Error 1 — GNOME Clocks no se podía reducir lo suficiente
- **Contexto:** fase inicial usando GNOME Clocks como stopwatch.
- **Síntoma:** la ventana no podía hacerse tan pequeña como para mostrar solo el cronómetro.
- **Causa raíz:** GNOME Clocks tiene un tamaño mínimo de ventana definido por el diseño de la app.
- **Solución aplicada:** se descartó GNOME Clocks como HUD minimalista y se migró a soluciones de terminal.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** validar desde el inicio si una app permite tamaño mínimo real antes de construir workflow alrededor de ella.

### Error 2 — `tty-clock` se ejecutaba como reloj, no como cronómetro
- **Contexto:** intento de usar `tty-clock` para Flowtime.
- **Síntoma:** mostraba la hora del sistema, no un contador desde cero.
- **Causa raíz:** `tty-clock` está orientado principalmente a mostrar reloj, no a funcionar como stopwatch Flowtime real en la forma requerida.
- **Solución aplicada:** se descartó y se pasó a buscar otra herramienta o construir script propio.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** verificar funcionalidad real de count-up antes de invertir tiempo en estética o configuración de ventana.

### Error 3 — `termdown` no estaba disponible vía `apt`
- **Contexto:** intento de instalar `termdown` con:
  ```bash
  sudo apt install termdown
  ```
- **Síntoma:** error:
  ```text
  E: Unable to locate package termdown
  ```
- **Causa raíz:** `termdown` no está en los repositorios oficiales disponibles para Pop!_OS/Ubuntu 22.04 en ese entorno.
- **Solución aplicada:** se intentó instalación con `pip3 install --user termdown`.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** confirmar fuente de instalación oficial de una herramienta antes de asumir que está en `apt`.

### Error 4 — `termdown --count-up` no existía en la versión instalada
- **Contexto:** después de instalar `termdown` con pip.
- **Síntoma:** error:
  ```text
  termdown: error: unrecognized arguments: --count-up
  ```
- **Causa raíz:** diferencias de versión/API de `termdown`; la versión instalada no incluía ese flag.
- **Solución aplicada:** se descartó `termdown` para evitar dependencia de versiones inconsistentes y se construyó script Bash propio.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** revisar `termdown --help` o documentación de la versión instalada antes de diseñar comandos sobre flags no confirmados.

### Error 5 — Primer script Bash era funcional pero poco estético
- **Contexto:** primera versión del cronómetro propio.
- **Síntoma:** el tiempo aparecía en una esquina o de forma poco centrada/pequeña.
- **Causa raíz:** el script solo imprimía con `printf` lineal, sin posicionamiento dinámico.
- **Solución aplicada:** se agregó centrado con `tput lines`, `tput cols` y `tput cup`.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** definir desde el inicio si el objetivo es funcionalidad pura o HUD visual.

### Error 6 — Cálculo de centrado fallaba al redimensionar/minimizar
- **Contexto:** versión centrada usando tamaño dinámico de terminal.
- **Síntoma:** el reloj desaparecía al hacer la ventana muy pequeña.
- **Causa raíz:** `tput lines` y `tput cols` podían devolver valores demasiado pequeños; el cálculo de posición podía producir columnas negativas o no tener espacio para renderizar `HH:MM:SS`.
- **Solución aplicada:** se añadieron validaciones:
  - verificar que `rows` y `cols` existan;
  - asegurar que haya al menos 1 fila;
  - asegurar que las columnas sean suficientes para imprimir el tiempo;
  - evitar columnas negativas.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** todo script TUI debe manejar terminal resize con condiciones de mínimo espacio.

### Error 7 — Comando largo de lanzamiento era incómodo
- **Contexto:** ejecución repetida del HUD.
- **Síntoma:** había que escribir:
  ```bash
  gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18 -e ./flowtime.sh
  ```
- **Causa raíz:** no existía alias, launcher ni comando automático en el perfil.
- **Solución aplicada:** se propusieron tres soluciones:
  - custom command del perfil;
  - alias `flowclock`;
  - launcher `.desktop`.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** crear desde temprano una abstracción de lanzamiento para cualquier micro-herramienta de uso recurrente.

### Error 8 — Al añadir funcionalidades visibles, el HUD dejó de ser minimalista
- **Contexto:** versión “Flowtime Pro Max” con sesión, total diario, recuadro y controles visibles.
- **Síntoma:** se veía desordenado, muy grande, con caja innecesaria, controles abajo y mal comportamiento al reducir la ventana.
- **Causa raíz:** se cambió el scope visual del proyecto: de un HUD de una línea a un dashboard TUI multilínea.
- **Solución aplicada:** se descartó la UI extra y se volvió a una sola línea con controles invisibles.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** no mezclar HUD minimalista con dashboard de métricas en la misma interfaz. Si se quieren métricas, deben ir a log/archivo, no a pantalla.

### Error 9 — El texto `q: quit` aparecía como único contenido al reducir ventana
- **Contexto:** versión con controles visibles.
- **Síntoma:** al hacer la ventana muy pequeña solo quedaba visible `q: quit`.
- **Causa raíz:** el script imprimía controles en líneas inferiores; al reducir la ventana, el cronómetro quedaba fuera del área visible o era desplazado por otros elementos.
- **Solución aplicada:** eliminar completamente controles visibles y mantener solo el tiempo.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** en UIs de terminal para overlays pequeños, no imprimir texto secundario permanente.

### Error 10 — GNOME Terminal tiene límite mínimo de ventana
- **Contexto:** incluso reduciendo fuente a JetBrains Mono 20, no se podía minimizar indefinidamente.
- **Síntoma:** la ventana no bajaba más allá de cierto tamaño o el contenido desaparecía al reducir demasiado.
- **Causa raíz:** GNOME Terminal/GTK impone un tamaño mínimo por header bar, padding interno, filas/columnas mínimas y decoración de ventana.
- **Solución aplicada:** aceptar el límite de GNOME Terminal o considerar otra terminal más configurable como Alacritty/Kitty.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** para HUDs ultrapequeños, elegir desde el inicio una terminal con mejor control de padding/decoraciones.

### Error 11 — Confusión entre comando de lanzamiento y custom command del perfil
- **Contexto:** configuración de GNOME Terminal.
- **Síntoma:** duda sobre si poner `gnome-terminal --profile="Pop Clock"...` dentro de “Run a custom command instead of my shell”.
- **Causa raíz:** confusión entre:
  - comando que abre una terminal;
  - comando que corre dentro de una terminal.
- **Solución aplicada:** aclarar que en “Run a custom command” debe ir el script:
  ```bash
  /home/eduardo.borjas/flowtime.sh
  ```
  y no el comando `gnome-terminal`.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** documentar la diferencia entre launcher externo y comando interno del perfil.

### Error 12 — `flowtime` como comando no existía
- **Contexto:** intento de ejecutar `flowtime` desde terminal.
- **Síntoma:** error:
  ```text
  flowtime: command not found
  ```
- **Causa raíz:** el script existía como archivo local (`flowtime.sh`), pero no estaba en `$PATH` ni había alias/comando instalado.
- **Solución aplicada:** ejecutar con `./flowtime.sh`, usar alias, o mover/symlinkear a `~/.local/bin/flowtime`.
- **Tiempo perdido:** DATO NO DISPONIBLE — requiere revisión manual.
- **Cómo prevenirlo:** si un script será herramienta recurrente, instalarlo en `~/.local/bin` desde el inicio.

---

## 3. DECISIONES TÉCNICAS CLAVE

### Decisión 1 — Usar Flowtime en lugar de Pomodoro
- **Opciones consideradas:**
  - Pomodoro con sesiones fijas.
  - Flowtime con cronómetro libre.
- **Decisión tomada:** Flowtime.
- **Justificación:** el objetivo era sostener enfoque profundo sin cortes artificiales; el usuario quería ver el tiempo para no desperdiciarlo, no ser interrumpido cada 25 minutos.
- **¿Fue la decisión correcta en retrospectiva?** Sí. Todo el diseño terminó orientándose a un count-up minimalista.

### Decisión 2 — Descartar GNOME Clocks
- **Opciones consideradas:**
  - Usar GNOME Clocks.
  - Crear HUD propio en terminal.
- **Decisión tomada:** descartar GNOME Clocks.
- **Justificación:** GNOME Clocks no permite reducir la ventana lo suficiente para un HUD.
- **¿Fue la decisión correcta en retrospectiva?** Sí. La app era funcional, pero no cumplía el requisito visual crítico.

### Decisión 3 — Descartar `tty-clock`
- **Opciones consideradas:**
  - `tty-clock`.
  - Script propio.
- **Decisión tomada:** descartar `tty-clock`.
- **Justificación:** se comportaba como reloj del sistema y no como cronómetro count-up Flowtime.
- **¿Fue la decisión correcta en retrospectiva?** Sí. El proyecto requería cronómetro desde cero, no reloj horario.

### Decisión 4 — Descartar `termdown`
- **Opciones consideradas:**
  - Instalar `termdown`.
  - Instalar desde GitHub.
  - Script Bash propio.
- **Decisión tomada:** script Bash propio.
- **Justificación:** `termdown` tuvo problemas de instalación por `apt` y flags incompatibles vía pip.
- **¿Fue la decisión correcta en retrospectiva?** Sí. Bash redujo dependencias y dio control total.

### Decisión 5 — Usar GNOME Terminal con perfil dedicado
- **Opciones consideradas:**
  - GNOME Terminal.
  - Alacritty.
  - Kitty.
  - App GUI dedicada.
- **Decisión tomada:** GNOME Terminal + perfil `Pop Clock`.
- **Justificación:** ya estaba disponible en el entorno, era rápido de configurar y suficiente para un MVP.
- **¿Fue la decisión correcta en retrospectiva?** Parcialmente. Correcta para iterar rápido; limitada para HUD ultracompacto por restricciones de tamaño mínimo.

### Decisión 6 — Mantener UI de una sola línea
- **Opciones consideradas:**
  - Dashboard con caja, sesión, total diario y controles visibles.
  - HUD minimalista de una línea.
- **Decisión tomada:** HUD de una sola línea.
- **Justificación:** las funcionalidades visibles rompían el objetivo principal: pequeño, limpio, siempre visible.
- **¿Fue la decisión correcta en retrospectiva?** Sí. Es la decisión más importante del proyecto.

### Decisión 7 — Controles invisibles en lugar de controles visibles
- **Opciones consideradas:**
  - Mostrar `p: pause | r: reset | q: quit`.
  - Mantener controles ocultos pero activos.
- **Decisión tomada:** controles invisibles.
- **Justificación:** los controles visibles ocupaban espacio, degradaban estética y rompían ventana mínima.
- **¿Fue la decisión correcta en retrospectiva?** Sí. Preserva funcionalidad sin sacrificar minimalismo.

### Decisión 8 — No usar dashboard de métricas en pantalla
- **Opciones consideradas:**
  - Mostrar sesión/total diario en el HUD.
  - Mantener solo tiempo actual.
- **Decisión tomada:** no mostrar métricas extra.
- **Justificación:** un HUD debe reducir carga cognitiva. Las métricas pueden ir a log si se implementan, pero no deben ocupar el overlay.
- **¿Fue la decisión correcta en retrospectiva?** Sí. El intento de dashboard empeoró la experiencia visual.

---

## 4. INTEGRACIONES COMPLEJAS

### Integración 1 — Script Bash + GNOME Terminal
- **Objetivo:** ejecutar un cronómetro propio en una ventana terminal pequeña y visualmente personalizada.
- **Proceso real:**
  1. Crear `~/flowtime.sh`.
  2. Dar permisos:
     ```bash
     chmod +x ~/flowtime.sh
     ```
  3. Ejecutar manualmente:
     ```bash
     ./flowtime.sh
     ```
  4. Abrirlo con perfil personalizado:
     ```bash
     gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18 -e ./flowtime.sh
     ```
- **Problemas encontrados:**
  - `-e` funciona, pero es una forma vieja/deprecada en algunos entornos. Alternativa más moderna:
    ```bash
    gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18 -- ~/flowtime.sh
    ```
  - El perfil debe ejecutar el script, no el comando que abre otra terminal.
- **Estado final:** integración funcional.

### Integración 2 — Perfil visual `Pop Clock`
- **Objetivo:** convertir GNOME Terminal en un HUD visual.
- **Proceso real:**
  - Crear perfil dedicado.
  - Cambiar fuente a JetBrains Mono.
  - Ajustar tamaño de fuente.
  - Definir color de texto verde/neón.
  - Fondo oscuro/transparente.
  - Desactivar blinking.
  - Ocultar menú con `--hide-menubar`.
- **Problemas encontrados:**
  - JetBrains Mono no estaba instalada por defecto.
  - GNOME Terminal tiene límite mínimo de ventana.
- **Estado final:** usable, aunque con limitaciones estructurales de GNOME Terminal.

### Integración 3 — Instalación de JetBrains Mono
- **Objetivo:** mejorar estética del cronómetro.
- **Comando recomendado:**
  ```bash
  sudo apt install fonts-jetbrains-mono
  ```
- **Problema:** la fuente no aparecía inicialmente porque no estaba instalada.
- **Estado final:** configurada como fuente del perfil.

### Integración 4 — Alias/launcher para ejecución rápida
- **Objetivo:** evitar escribir el comando completo.
- **Opciones documentadas:**
  - Alias en `~/.bashrc`.
  - Custom command del perfil.
  - `.desktop launcher`.
- **Estado final:** DATO NO DISPONIBLE — requiere revisión manual para confirmar cuál quedó implementado permanentemente.

---

## 5. USO Y LEARNINGS

- **Qué tipos de tareas delegaste completamente a Claude Code:**
  - DATO NO DISPONIBLE — requiere revisión manual.
  - En esta conversación no se usó Claude Code directamente; el desarrollo fue guiado conversacionalmente y ejecutado manualmente en terminal.

- **Qué tareas requirieron más intervención manual:**
  - Ejecutar comandos en Pop!_OS.
  - Instalar paquetes/fuentes.
  - Editar `flowtime.sh` con `nano`.
  - Ajustar preferencias de GNOME Terminal.
  - Probar visualmente tamaños de ventana.
  - Hacer screenshots para validar UI.
  - Detectar cuándo una solución era funcional pero no estética.

- **Prompts o instrucciones que funcionaron especialmente bien:**
  - “Flowtime en lugar de Pomodoro” definió correctamente la lógica del sistema.
  - “Productividad hardcore” impulsó la configuración visual tipo HUD.
  - “Todo desde el script” ayudó a centralizar la funcionalidad.
  - “No quiero recuadro ni controles visibles en la ejecución del script” corrigió el exceso de UI.
  - “Volver al modelo ultra minimal de una sola línea” fue la instrucción clave para recuperar usabilidad.

- **Limitaciones encontradas:**
  - GNOME Clocks no es reducible a tamaño HUD.
  - `tty-clock` no resolvió count-up Flowtime.
  - `termdown` tuvo diferencias de instalación/API.
  - GNOME Terminal tiene mínimo de ventana por GTK/header bar.
  - Una terminal no es ideal para overlays ultrapequeños con decoración de ventana.
  - Agregar métricas visibles rompe la estética y reduce la capacidad de minimizar.

- **Workflow que repetirías en el próximo proyecto:**
  1. Definir primero la interfaz mínima real.
  2. Probar rápidamente apps existentes.
  3. Descartar temprano herramientas que no cumplan el requisito principal.
  4. Crear script propio si el comportamiento requerido es simple.
  5. Separar lógica invisible de UI visible.
  6. Iterar con screenshots.
  7. Convertir el script en comando/launcher cuando ya esté estable.

---

## 6. INSIGHTS CLAVE (no obvios)

- **Insight 1:** Para un HUD de productividad, “más funcionalidad visible” puede empeorar el sistema. La función debe existir, pero no necesariamente mostrarse.

- **Insight 2:** Un cronómetro Flowtime no necesita dashboard; necesita presencia constante. El valor está en ver el paso del tiempo sin fricción.

- **Insight 3:** GNOME Terminal sirve para prototipar HUDs, pero no es una herramienta ideal para overlays ultrapequeños por límites de GTK/header bar.

- **Insight 4:** La ventana mínima útil no depende solo del tamaño de fuente. Depende también de padding, header bar, filas/columnas mínimas y decoración de ventana.

- **Insight 5:** Los scripts TUI deben diseñarse con “resize failure” desde el inicio. Si el área visible es menor que el contenido, el script debe no dibujar o degradarse elegantemente.

- **Insight 6:** Para overlays, la arquitectura correcta es “una línea visible + controles invisibles”. Mostrar instrucciones permanentes convierte el HUD en una interfaz pesada.

- **Insight 7:** Las herramientas externas simples pueden perder contra un script propio si el requerimiento es muy específico y minimalista.

- **Insight 8:** Si una herramienta será usada diariamente, el launcher/alias no es un lujo; es parte de la arquitectura del sistema.

- **Insight 9:** Flowtime requiere un count-up, no un timer countdown. Muchas herramientas de productividad están sesgadas hacia Pomodoro y no se ajustan bien al enfoque profundo sin cortes.

- **Insight 10:** La estética no es secundaria en herramientas de productividad persistentes. Si una herramienta está siempre visible, su diseño afecta directamente la disposición mental para usarla.

---

## 7. KEY TAKEAWAYS — LO QUE CAMBIARÍA

### Técnico:
- Empezaría directamente con Bash en lugar de probar demasiadas herramientas externas.
- Mantendría desde el inicio una UI de una sola línea.
- No añadiría cajas, controles visibles ni métricas en pantalla.
- Guardaría métricas en archivo/log separado si se requieren, pero no las mostraría en el HUD.
- Usaría `gnome-terminal -- ...` en lugar de `-e` para mayor compatibilidad:
  ```bash
  gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=45x8 -- ~/flowtime.sh
  ```
- Consideraría Alacritty o Kitty desde el inicio si el objetivo es un HUD ultracompacto sin decoración.
- Instalaría el script como comando:
  ```bash
  mkdir -p ~/.local/bin
  cp ~/flowtime.sh ~/.local/bin/flowtime
  chmod +x ~/.local/bin/flowtime
  ```
- Crearía un launcher `.desktop` cuando la versión final esté estable.

### Proceso / metodología:
- Definiría primero el “mínimo visual aceptable”.
- Haría una matriz rápida de herramientas candidatas antes de instalar/configurar.
- Validaría cada herramienta con el caso crítico: “¿puede verse bien en ventana mínima?”.
- Separaría claramente:
  - funcionalidad esencial;
  - estética;
  - automatización de lanzamiento;
  - tracking/logs.
- Evitaría scope creep visual. El intento de convertir el HUD en dashboard fue un desvío.
- Usaría screenshots como criterio de aceptación, no solo “funciona en terminal”.
- Documentaría cada comando definitivo inmediatamente después de validarlo.

---

## Script final recomendado

```bash
#!/bin/bash

start_time=$(date +%s)
paused=false
pause_time=0
total_pause=0

tput civis
stty -echo -icanon time 0 min 0

cleanup() {
    tput cnorm
    stty sane
    clear
    exit
}

trap cleanup INT TERM

while true; do

    # Leer tecla sin bloquear
    key=$(dd bs=1 count=1 2>/dev/null)

    case "$key" in
        p)
            if [ "$paused" = false ]; then
                paused=true
                pause_time=$(date +%s)
            else
                paused=false
                now=$(date +%s)
                total_pause=$((total_pause + now - pause_time))
            fi
            ;;
        r)
            start_time=$(date +%s)
            total_pause=0
            paused=false
            ;;
        q)
            cleanup
            ;;
    esac

    if [ "$paused" = false ]; then
        now=$(date +%s)
        elapsed=$((now - start_time - total_pause))
    fi

    hours=$((elapsed / 3600))
    minutes=$(((elapsed % 3600) / 60))
    seconds=$((elapsed % 60))

    time_string=$(printf "%02d:%02d:%02d" $hours $minutes $seconds)

    rows=$(tput lines 2>/dev/null)
    cols=$(tput cols 2>/dev/null)

    # Protección para ventana mínima
    if [[ -z "$rows" || -z "$cols" || "$rows" -lt 1 || "$cols" -lt ${#time_string} ]]; then
        sleep 0.1
        continue
    fi

    row=$((rows / 2))
    col=$(((cols - ${#time_string}) / 2))
    ((col < 0)) && col=0

    clear
    tput cup $row $col
    printf "%s" "$time_string"

    sleep 0.1
done
```

## Comando recomendado de lanzamiento

```bash
gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=45x8 -- ~/flowtime.sh
```

## Estado final del proyecto

- **Estado:** MVP funcional.
- **Nivel de estabilidad:** bueno para uso diario.
- **Mayor limitación pendiente:** tamaño mínimo estructural de GNOME Terminal.
- **Siguiente mejora lógica:** convertirlo en launcher permanente o migrar a Alacritty/Kitty si se necesita un HUD más pequeño y sin decoración.
