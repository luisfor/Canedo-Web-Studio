---
name: sistemas-embebidos
description: Programar y depurar C, C++ y Arduino, con compilación nativa, manejo de memoria, protocolos y firmware; distinguir simulación de pruebas en hardware.
---

# C, C++ y Arduino
Distingue ejecutable, biblioteca y microcontrolador. Para fuentes completas usa compiladores/debuggers normales; REA corresponde a binarios o evidencia de ejecución solicitada.

## C y C++
Respeta estándar, ABI, plataforma y build existente. En C documenta ownership, tamaños y errores; en C++ prefiere RAII y contenedores. No impongas excepciones o RTTI en targets que no las soporten.
Comprueba límites, overflow, conversiones con signo, alineación y endianness. Usa warnings y sanitizers compatibles en host; no afirmes que verifican un MCU. Prueba parsers con entradas truncadas.
Separa lógica pura de I/O. En concurrencia define ownership y sincronización: volatile no reemplaza atomics ni mutex.

## Arduino
Identifica placa/FQBN, voltajes, pines, periféricos y librerías exactas. Verifica pinout y límites del fabricante: AVR, ESP32 y ARM no comparten necesariamente timers, memoria o niveles eléctricos.
Mantén interrupciones cortas y protege datos compartidos. Prefiere máquinas de estado y millis() con resta sin signo para rollover frente a delays largos. Controla asignaciones dinámicas en RAM limitada.

## Validación y entrega
En host usa CMake/CTest o el build existente; para Arduino compila con CLI y FQBN identificados. Entrega conexiones, dependencias, build y estados de fallo. Sin placa, limita la conclusión a compilación o simulación.
Cargar firmware y activar actuadores son efectos distintos: confirma destino y efectos cuando no estén establecidos por la petición.
Fuentes: [Arduino CLI](https://docs.arduino.cc/arduino-cli/), [lenguaje Arduino](https://docs.arduino.cc/language-reference/), [CMake](https://cmake.org/cmake/help/latest/), [sanitizers Clang](https://clang.llvm.org/docs/AddressSanitizer.html).
