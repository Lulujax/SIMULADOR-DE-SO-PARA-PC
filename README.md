# Simulador de Sistema Operativo

Simulador didáctico de un sistema operativo de escritorio. Todo ocurre dentro de un
escritorio con ventanas, barra de tareas y menú de inicio. **Cada aplicación que
abres es un proceso real**: nace en «Nuevo», pide memoria, espera en la cola de
listos, se ejecuta, se bloquea cuando espera a un dispositivo y termina con HALT.

No hay backend: el núcleo entero (planificador, memoria, E/S e interrupciones) corre
en el navegador.

## Cómo ejecutarlo

```bash
npm install
npm run dev      # http://localhost:5173
```

Otros scripts: `npm run build`, `npm run preview`, `npm run lint`.

## El escritorio

- **Iconos**: un clic abre la app, arrastrar los mueve (guarda la posición) y el
  botón derecho abre su menú propio.
- **Selección por marco**: arrastra sobre el fondo para marcar una zona.
- **Clic derecho en el escritorio**: menú del sistema con Ver (mostrar/ocultar iconos,
  tamaño), Ordenar iconos, Actualizar, Terminal, proceso en segundo plano, fondo de
  escritorio, Configuración y Mostrar escritorio.
- **Clic derecho en una ventana o en su título**: minimizar, maximizar, abrir el
  administrador de tareas o cerrar el proceso.

El menú contextual es propio: el navegador nunca enseña el suyo.

## La barra de tareas

- Botón **Inicio** (o tecla Windows) con buscador de aplicaciones.
- Controles de simulación: ▶/⏸, avanzar un ciclo (→), reiniciar (R) y velocidad 1×–4×.
- **Aplicaciones ancladas** siempre visibles: Flujo, Estados, Memoria, Hardware y Red.
  Un punto de color indica el estado del proceso y una línea inferior marca las que
  están abiertas. Clic abre o restaura; clic en la activa la minimiza.
- Botones de las demás ventanas abiertas: clic para enfocar o minimizar.
- **Ajustes rápidos** (una sola pieza): red, sonido, bloquear, el **volumen real del
  equipo** y la energía (suspender, reiniciar, apagar).
- Centro de notificaciones con el reloj y el uso de CPU/RAM.
- En pantallas estrechas las ancladas se ocultan para que la barra nunca desborde.

## Hardware real del equipo

El simulador no es una maqueta cerrada: varios paneles leen **el equipo donde se
está ejecutando** mediante las APIs del navegador.

| Dato | Origen |
| --- | --- |
| Núcleos lógicos y carga | `navigator.hardwareConcurrency` + medición real del hilo principal con `requestAnimationFrame` |
| Memoria del motor | `performance.memory` (montículo y límite del heap) |
| Almacenamiento | `navigator.storage.estimate()` |
| Batería | `navigator.getBattery()` con eventos `levelchange` y `chargingchange` |
| Red | `navigator.onLine` + eventos `online`/`offline` y `connection` |
| Pantalla | `window.innerWidth/Height`, `devicePixelRatio` y `colorDepth` |
| Sonido | Web Audio API (`AudioContext` con ganancia maestra) |

El deslizador de volumen mueve la **ganancia real de la salida de audio** del
navegador y hay un botón «Probar tono» para comprobarlo. No es posible cambiar el
volumen maestro del sistema operativo desde una web: el panel lo dice explícitamente.

## El navegador y por qué hay páginas que no se ven

La aplicación **Navegador** es un navegador real: contiene la página en un `iframe`
de verdad y navega de verdad. Cada visita genera una petición a la tarjeta de red
simulada, así que el proceso se bloquea en la cola mientras «descarga».

Lo abre:

- **Google**, con `https://www.google.com/webhp?igu=1`. El parámetro `igu=1` es el
  modo de incrustación de Google: sin él, su cabecera `frame-ancestors` impide
  meterlo en un marco y saldría en blanco.
- Búsquedas: lo que escribas sin esquema se manda a
  `https://www.google.com/search?igu=1&q=…`.
- Cualquier dirección: `wikipedia.org`, `developer.mozilla.org`, `example.com`…
- Botón **Abrir en pestaña nueva** para los sitios que no se dejan incrustar.

**Limitación real del navegador, no del simulador:** por seguridad, muchos sitios
envían `X-Frame-Options` o `frame-ancestors` para prohibir que se muestren dentro de
otra aplicación. Bing, DuckDuckGo, Startpage, Facebook, X, Instagram, LinkedIn y
YouTube son de ese tipo: ahí el marco queda en blanco y no hay forma de evitarlo
desde una web. El navegador lo detecta y avisa con un botón para abrirlo aparte.

## La cámara y por qué puede no verse

`Cámara` abre `getUserMedia` y reproduce **tu cámara real** en el `<video>`, con el
nombre del dispositivo en la esquina. Si algo falla, lo dice con precisión y deja
un botón **Reintentar**:

| Situación | Qué muestra |
| --- | --- |
| Permiso denegado | «Autoriza la cámara desde el candado de la barra de direcciones y reinténtalo» |
| Sin cámara en el equipo | «Este equipo no tiene ninguna cámara conectada» |
| Cámara ocupada | «Otra aplicación está usando la cámara» |

En el primer uso el navegador pide permiso: hay que **aceptar**. Si se deniega
y se cambia de idea, hay que reabrir el candado de la barra de direcciones → icono
de cámara → **Permitir**, y después pulsar Reintentar.

## Ciclo de vida del equipo

| Acción | Qué ocurre |
| Apagar | Pantalla negra. «Encender» (o doble clic) arranca el núcleo. |
| Encender | Pantalla de arranque con barra de progreso y después el escritorio. |
| Reiniciar | Reinicia núcleo, procesos y ventanas. |
| Suspender | Pantalla oscura; cualquier clic despierta. |
| Bloquear | Pantalla de bloqueo con reloj. Contraseña: `simulador`. |
| Cerrar sesión | Cierra todo y apaga el equipo. |

## Las aplicaciones

| Aplicación | Proceso | Dispositivo | Qué demuestra |
| --- | --- | --- | --- |
| Bloc de notas | `notepad.exe` | Teclado | **Escribes de verdad**: cada tecla genera una interrupción de E/S y el proceso se bloquea esperando al controlador. |
| Calculadora | `calc.exe` | — | **Funciona de verdad** (`+ − × ÷ % ± C`): opera directamente sobre el acumulador AC del proceso, así que ves la ALU. |
| Cámara | `camera.exe` | — | **Enseña tu webcam en directo** (`getUserMedia`). Muestra el nombre real del dispositivo, y si el permiso se deniega o no hay cámara explica el motivo exacto y ofrece **Reintentar**. Cada disparo guarda un archivo en Imágenes y consume CPU. |
| Fotos | `photos.exe` | — | Galerie de las capturas. |
| Explorador de archivos | `explorer.exe` | Disco | Navega, **crea carpetas**, **mueve** archivos (arrastrando o con el botón derecho) y los borra. |
| Terminal | `terminal.exe` | — | Consola con órdenes reales: `help`, `ls`, `cd`, `cat`, `mkdir`, `rm`, `ps`, `kill`, `top`, `open`, `power`, `neofetch`, `echo`, `clear`. |
| Navegador | `browser.exe` | Red | **Navegador de verdad**: barra de direcciones, atrás/adelante/recargar, marcadores y búsqueda. Arranca en **Google** y admite cualquier URL. |
| Impresora | `writer.exe` | Impresora | El recurso ancla que más bloquea el sistema. |
| Configuración | `settings.exe` | — | Fondo, tamaño de iconos, tema e información del sistema. |
| Administrador de tareas | `taskmgr.exe` | — | Tabla de procesos con CPU, memoria, suspender y terminar. |
| Registro del sistema | `syslog.exe` | — | Eventos del núcleo **y los errores detectados**, con traza. |
| Servicio | `service.exe` | — | Proceso en segundo plano, sin ventana. |

### Ventanas internas del sistema

Estas cinco ventanas son las que muestran el funcionamiento interno que pide el enunciado.
Están ancladas en la barra de tareas.

| Ventana | Proceso | Qué demuestra |
| --- | --- | --- |
| **Flujo del sistema** | `kernelview.exe` | Diagrama `@xyflow/react` con la ruta activa en vivo: interrupción → núcleo → planificador → cola de listos → CPU → memoria → bloqueados → E/S → swap. Cada nodo muestra su métrica y se ilumina cuando el sistema pasa por él. |
| **Estados y sincronización** | `fsm.exe` | Los seis estados con su población en vivo, las transiciones posibles explicadas, el historial de transiciones con su motivo, los semáforos, los mutex con su propietario y cola, y los contadores compartidos. Permite suspender (swap), reactivar y terminar procesos. |
| **Gestor de memoria** | `memsys.exe` | Marcos y particiones en vivo, bits de referencia y de modificación, tablas de páginas, y las métricas de **fragmentación interna** (particiones estáticas) y **externa** (dinámicas). Cambia el esquema, el tamaño de página, activa intercambio y compacta. |
| **Hardware del equipo** | `hwmon.exe` | Los sensores reales del PC y los periféricos simulados, con petición de E/S real sobre cada dispositivo. |
| **Monitor de red** | `netmon.exe` | La conexión real del navegador junto a la tarjeta de red simulada, su cola de peticiones y el gráfico de actividad de la CPU. |

## Atajos de teclado

- `Espacio` — iniciar o pausar
- `→` — avanzar un ciclo
- `R` — reiniciar la simulación
- `D` — mostrar el escritorio
- `Windows` — menú de inicio

## Lo que ocurre por dentro

- **Estados**: Nuevo → Listo → Ejecutando → Bloqueado → Terminado, más Suspendido.
- **Planificación**: Round Robin con quantum ajustable.
- **Memoria**: paginación con tabla de páginas; el Explorador muestra dónde está
  cada página de su proceso.
- **E/S**: teclado, disco, red e impresora, cada uno con su cola y su velocidad. Al
  terminar generan una interrupción que la CPU atiende antes de seguir.
- **Ventana de estado**: cada ventana muestra la instrucción que ejecuta su
  proceso, el dispositivo que espera y su progreso.

## Registro de errores

Cualquier fallo de la interfaz o de una acción queda capturado en la pestaña
**errores** de «Registro del sistema»: tipo, hora, ciclo, origen, mensaje y traza.
Los paneles están además protegidos con un cortafuegos para que un fallo no tumbe
el escritorio.

## Arquitectura

```
src/
├── types/os.ts          Modelo de datos del simulador
├── lib/                 Motor: engine, scheduler, memory, io, gestures, palette, realHardware
├── store/               Zustand: simStore, systemStore, windowStore, menuStore, errorStore
├── hooks/               useSim, reloj, atajos, lanzador, vigilante de errores
├── apps/                Registro de aplicaciones, AppContent y SystemApps (ventanas internas)
└── components/desktop/  Escritorio, ventanas, iconos, barra de tareas, menús, pantallas
```

El motor muta el snapshot en sitio y publica un contador de versión; `useSim` lo
consume para repintar en cada ciclo sin clonar el árbol de estado.

## Decisiones de diseño

Las pautas de Apple aplicadas a la web:

- **Ventanas físicas**: arrastre 1:1 respetando el punto de agarre, inercia que
  hereda la velocidad del dedo al soltar, resistencia progresiva en los bordes y
  anclaje con previsualización al arrastrar a un borde.
- **Materiales translúcidos** (`backdrop-filter`) en barra de tareas y menús, con el
  peso del blur codificando la jerarquía.
- **Resortes críticos** (`damping 1.0`) por defecto; rebote sólo con inercia real.
- **Accesibilidad**: `prefers-reduced-motion`, `prefers-reduced-transparency` y
  `prefers-contrast` respetados; cada control conserva su nombre accesible.