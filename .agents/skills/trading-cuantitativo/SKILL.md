---
name: trading-cuantitativo
description: Desarrollar investigación cuantitativa, backtesting, simulación y software de trading; evaluar datos, ejecución y riesgo sin prometer rentabilidad.
---

# Investigación y software de trading
Esta skill es un procedimiento de ingeniería, no una certificación financiera ni acceso a mercados. Determina activo, frecuencia, horizonte, fuente y si se pide investigación, paper trading o ejecución real. Analizar no autoriza enviar órdenes.

## Datos y señales
Versiona datos y parámetros; registra zona horaria, calendario, splits/dividendos y activos excluidos. Distingue bid/ask, operaciones y cierre. Usa solo información disponible en el instante simulado para evitar look-ahead y survivorship bias.
Especifica señal, instante de disponibilidad, precio de ejecución, sizing, límites, salidas y efectivo. Una señal calculada al cierre no se ejecuta automáticamente al mismo precio de cierre.

## Backtest reproducible
Incluye comisión, spread, slippage, financiación, préstamo y liquidez según mercado. Reserva periodo fuera de muestra y walk-forward; registra número de variantes exploradas. No ajustes parámetros mirando el test final.
Presenta pérdidas/ganancias, drawdown, exposición, rotación, operaciones y benchmark con periodo, costes y supuestos. Explica anualización y muestras pequeñas. Haz sensibilidad y escenarios adversos. Un resultado histórico no garantiza ganancias.

## Ejecución
Empieza por simulación. Para un broker consulta documentación actual, sandbox, permisos y rate limits. Modela estados, fills parciales, cancelación, reconciliación e idempotencia: una desconexión no demuestra que la orden falló.
Separa datos, señales, cartera, riesgo y ejecución. Añade límites de exposición/pérdida y parada verificable. No guardes claves en Git y evita permisos de retiro.
No envíes órdenes reales ni muevas fondos sin instrucción explícita de cuenta, activo y alcance. Para recomendaciones financieras o datos actuales consulta fuentes oficiales vigentes y distingue hechos de supuestos.

## Entrega
Entrega código reproducible, datos o instrucciones de obtención, configuración sin secretos y reporte con limitaciones. Sin datos no inventes resultados. Prueba contabilidad y ausencia de filtración temporal con casos pequeños.
Fuente de conexiones: documentación oficial del broker elegido. Contexto de inversión: [Investor.gov](https://www.investor.gov/). Ningún broker queda instalado con esta skill.
