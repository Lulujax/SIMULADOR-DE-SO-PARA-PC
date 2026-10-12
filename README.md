# Simulador de Sistema Operativo (estilo Windows)

Simulador didáctico de un sistema operativo de escritorio. Todo ocurre dentro de un
escritorio con ventanas, taskbar y menú de inicio. **Cada aplicación que abres es un
proceso real** del sistema simulado: consume CPU, pide memoria, se bloquea esperando
los dispositivos y termina.

No hay backend: el núcleo entero (planificador, memoria, E/S e interrupciones) corre en
el navegador.

## Cómo ejecutarlo

```bash
npm install
npm run dev      # http://localhost:5173
```

Otros scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Cómo se usa

1. Pulsa **Inicio** (o haz doble clic en un icono del escritorio) y abre una aplicación.
2. Cada app crea un proceso en estado **Nuevo**. El gestor de memoria le concede un
   espacio y pasa a **Listo**.
3. Pulsa **▶** en la barra de tareas para arrancar el reloj del sistema. A partir de ahí
   el planificador reparte la CPU entre los procesos y verás cómo cambian de estado
   en la barra de título de cada ventana.
4. Abre el **Administrador de tareas** para ver la tabla en vivo y poder suspender o
   terminar procesos.
5. Cierra una ventana con la ✕: el proceso termina y el sistema libera su memoria.

### Atajos de teclado

- `Espacio` — iniciar o pausar la simulación
- `→` — avanzar un ciclo
- `R` — reiniciar todo el sistema
- `D` — mostrar el escritorio (minimizar todas las ventanas)

### Con las ventanas

- **Arrastrar** por la barra de título: la ventana sigue al puntero 1:1 y al soltar
  hereda su velocidad.
- **Doble clic** en la barra de título: maximizar o restaurar.
- **Arrastrar al borde** superior, izquierdo o derecho: previsualiza el anclaje.
- **Esquina inferior derecha**: redimensionar.

## Las aplicaciones y a qué_dispositivo_ van

| Aplicación | Proceso | Dispositivo | Qué demuestra |
| --- | --- | --- | --- |
| Bloc de notas | `notepad.exe` | Teclado | Cada tecla es una interrupción de E/S. |
| Calculadora | `calc.exe` | — | Trabajo puro de CPU: nunca se bloquea. |
| Explorador de archivos | `explorer.exe` | Disco duro | El dispositivo más lento: muchos bloqueos. |
| Navegador | `browser.exe` | Red | Descargas y esperas por la red. |
| Impresora | `writer.exe` | Impresora | El recurso ancla que más bloquea el sistema. |
| Terminal | `terminal.exe` | — | Línea de órdenes en modo texto. |
| Administrador de tareas | `taskmgr.exe` | — | Tabla de procesos con CPU, memoria y estado. |
| Registro del sistema | `syslog.exe` | — | Bitácora completa de eventos del núcleo. |
| Servicio | `service.exe` | — | Proceso en segundo plano, sin ventana. |

## Lo que ocurre por dentro

- **Planificación**: Round Robin con quantum ajustable (1–4×), más FIFO y prioridades
  disponibles desde el código de configuración.
- **Estados**: Nuevo → Listo → Ejecutando → Bloqueado → Terminado, más Suspendido
  por intercambio a disco.
- **Memoria**: paginación con tabla de páginas visible dentro del Explorador.
- **E/S**: cuatro dispositivos con su propia cola y velocidad; al terminar generan una
  interrupción que la CPU atiende antes de seguir.
- **Ventana de estado**: cada ventana muestra la instrucción que está ejecutando su
  proceso, el dispositivo que espera y su progreso.

## Arquitectura

```
src/
├── types/os.ts          Modelo de datos completo del simulador
├── lib/                 Motor: engine, scheduler, memory, io, gestures, palette
├── store/               Zustand: simStore (simulación) y windowStore (ventanas)
├── hooks/               useSim, reloj, atajos, lanzador de aplicaciones, import/export
├── apps/                Registro de aplicaciones y su contenido de ventana
└── components/desktop/  Escritorio, ventanas, iconos y barra de tareas
```

El motor muta el snapshot en sitio y publica un contador de versión; `useSim` lo
consume para repintar en cada ciclo sin clonar el árbol de estado.

## Decisiones de diseño

Las pautas de Apple aplicadas a la web:

- **Ventanas físicas**: arrastre 1:1 respetando el punto de agarre, inercia que hereda
  la velocidad del dedo al soltar, resistencia progresiva en los bordes y anclaje con
  previsualización.
- **Materiales translúcidos** (`backdrop-filter`) para la barra de tareas y el menú de
  inicio, con el peso del blur codificando la jerarquía.
- **Resortes críticos** (`damping 1.0`) por defecto; el rebote sólo cuando el gesto
  aporta inercia.
- **Tipografía óptica**: tracking negativo en títulos, positivo en microletras.
- **Accesibilidad**: se respetan `prefers-reduced-motion`, `prefers-reduced-transparency`
  y `prefers-contrast`; cada control conserva su nombre accesible.