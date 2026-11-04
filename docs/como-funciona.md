# Cómo funciona

## El botón Buscar

1. Para cada palabra clave activa, cada plataforma busca las vacantes publicadas **desde hoy
   hasta 3 meses atrás**.
   - La primera vez trae los 3 meses completos. Las siguientes solo traen lo nuevo desde la
     última búsqueda exitosa de esa plataforma (con 2 días de margen). Una palabra clave
     recién agregada sí busca sus 3 meses.
   - Algunas plataformas no muestran 3 meses hacia atrás. En ese caso se trae lo que haya y
     el historial se completa con el uso.
   - Cada palabra clave recuerda cuándo se buscó completa en cada plataforma. Las plataformas
     que limitan mucho (LinkedIn) tienen un cupo de peticiones por búsqueda: al llegar, se
     detienen y las palabras que faltaron siguen en la próxima búsqueda, empezando por las que
     llevan más tiempo sin buscarse.
2. Cada adapter filtra por tu `profile/location.json`: vacantes **remotas abiertas a tu
   país**, o **presenciales/híbridas en tu ciudad**, y solo en los idiomas que aceptas.
3. Guarda cada vacante con su **fecha de publicación** y **quién la publica**, y registra
   cada fecha de publicación distinta (así se detectan las republicaciones).
4. La misma vacante encontrada con varias palabras clave es una sola fila. En plataformas que
   buscan por sinónimos (como Computrabajo), solo se guardan las vacantes que mencionan la
   búsqueda (sus palabras en orden y cerca).
5. En las plataformas cuyo listado no trae la descripción (Computrabajo, LinkedIn), se pide la
   página de cada vacante **solo la primera vez que aparece**, y queda guardada aunque la
   vacante se descarte. Por eso la primera búsqueda tarda bastante más que las siguientes.
6. Con la descripción se detecta el **idioma**: si tu perfil no acepta inglés, se descartan
   las vacantes en inglés aunque la plataforma no lo indique.
7. Al terminar, recalcula la lista negra (ver abajo).

Las plataformas corren en paralelo; dentro de cada una, las peticiones van de a una.

## Mapa de calor

Cada vacante se compara con `profile/skills.json`, que tiene dos listas: las tecnologías que
**tienes** y las que **no**.

```
encaje = tecnologías pedidas que tienes / tecnologías pedidas reconocidas
```

- Lo que aparece en el **título** cuenta doble: es lo central del cargo.
- 🟢 **75% o más** · 🟠 **40% a 75%** · 🔴 **menos de 40%** · gris si la vacante no menciona
  ninguna tecnología de tu lista.
- Debajo del título se ven las que tienes (verde) y las que no (✗ en rojo).
- Las tecnologías genéricas (SQL, Git, REST, CI/CD, HTML/CSS) se dejan fuera a propósito: las
  piden casi todas las vacantes y hacían que cualquier cosa saliera verde.
- La lista se ordena por este porcentaje (100% primero) y, a igual porcentaje, por fecha de
  publicación, sin importar la plataforma. Las grises van al final.
- Si una empresa tiene varias vacantes en tu lista, la de mejor encaje lleva **★ la mejor de
  N**. Si todas son rojas, ninguna lleva ★.

Ejemplos con un perfil fullstack TypeScript: "Java + Angular" sale naranja (50%), "Kotlin /
Java" sale rojo (14%), "Node.js / TypeScript / React / AWS" sale verde (94%).

## Lista negra

Algunas empresas publican la misma vacante mes a mes para juntar CVs, y tapan a las que
contratan de verdad. JobFilter las saca de tu lista.

### Cuándo cae una empresa

Cuando publica **la misma vacante 3 o más veces dentro de 3 meses**.

- Una sola republicación puede ser real (la persona contratada no funcionó). Con **2
  publicaciones** la vacante sigue en tu lista con el aviso **"⟲ 2ª publicación, desde
  <fecha>"**.
- Publicaciones a menos de **7 días** entre sí cuentan como una sola (por ejemplo, la misma
  vacante en dos plataformas o en dos versiones el mismo día).
- Las fechas que son solo un tope ("Más de 30 días") no cuentan: cambiarían cada día y
  parecerían republicaciones.

### Qué es "la misma vacante"

Se compara cuánto texto comparten las descripciones (grupos de 3 palabras seguidas, índice de
Jaccard). Medido con vacantes reales:

| Caso | Texto compartido |
|---|---|
| Vacantes distintas de una misma empresa | hasta ~21% (comparten la presentación de la empresa) |
| La misma vacante con el texto retocado | ~70% |
| Copia exacta con otro título | 100% |

- **El script solo** las considera la misma si tienen el **mismo título normalizado** o una
  descripción **≥ 90% igual**.
- **Con tu descarte** basta con **≥ 60%**: cuando aprietas *Descarto* le estás diciendo que es
  la misma vacante aunque el texto cambie. Ese descarte suma una publicación al conteo, pero
  no tumba a ninguna empresa por sí solo.

### Empresas confidenciales

Algunas vacantes no dicen la empresa ("Empresa confidencial", "Importante empresa del
sector"). Como no hay nombre que comparar, se agrupan por la descripción:

- Son la misma vacante si la descripción es **≥ 90% igual**, o si tienen el **mismo título y
  una descripción ≥ 60% igual**. El título solo no alcanza: muchas empresas distintas publican
  "Desarrollador Backend" sin dar su nombre. Con tu descarte basta con **≥ 60%**, como
  siempre.
- Cuando una se publica más de una vez, sus publicaciones quedan bajo un **publicador
  confidencial**, que aparece como `Empresa confidencial: "<título>"`. Desde ahí sigue la regla
  de siempre: aviso ⟲, lista negra con 3 publicaciones en 3 meses, Bloquear y lista blanca.
- Medido con vacantes reales: entre confidenciales distintas, la mediana de texto compartido
  es 0,4%; las repetidas comparten entre 78% y 100%.

### Lo que decides tú

- **Bloquear** (junto al nombre de la empresa): la manda a la lista negra a mano. Sirve para
  empresas que publican muchas vacantes *distintas* sin contratar, algo que la regla
  automática no detecta. Se deshace con **Desbloquear**.
- **Lista blanca**: la empresa nunca cae automáticamente, aunque repita. Útil para
  consultoras o software factories que contratan seguido de verdad.
- **Retomar** (en *Descartadas*): la vacante vuelve a tu lista y el conteo se recalcula; si la
  empresa había caído por ese descarte, sale de la lista negra.
- **Apliqué**: la vacante pasa a *Aplicadas*, donde se busca por texto (cargo, empresa, ciudad
  o tecnología, en el título y la descripción) y se filtra por plataforma y por cuándo
  aplicaste. **Deshacer** la devuelve a la lista. Aplicar no cuenta para la lista negra.

La lista negra se recalcula entera al terminar cada búsqueda, al descartar, al retomar y al
quitar una empresa de una lista. Nunca toca las decisiones manuales.

Cada empresa en la lista negra muestra el **motivo** (qué vacante repitió, cuántas veces y
entre qué fechas) y, al desplegarla, todas sus vacantes con las que prueban el motivo
marcadas con ⟲.

## Para no ser bloqueado

- **Sin login**: el script nunca inicia sesión. Si no hay cuenta, no hay cuenta que bloquear.
- **Poco volumen**: una petición a la vez por plataforma, con pausas aleatorias entre ellas.
- **Incremental**: después de la primera búsqueda solo se pide lo nuevo.
- **Freno en LinkedIn**: al menos 30 minutos entre corridas, y cada palabra clave como mucho
  una vez por semana. Apretar Buscar seguido no le hace peticiones; las demás plataformas
  buscan normal.
- **Pausa automática**: si una plataforma responde 429, 403, 999 (LinkedIn) o un captcha, queda
  en pausa: 1 día, y más si se repite (hasta una semana). Una redirección al muro de login
  también cuenta como bloqueo. LinkedIn, ante un 429, reintenta una vez, corta la búsqueda y
  queda en pausa corta; ante un bloqueo se pausa 30 minutos, 2 horas, 8 horas y 1 día. Las
  demás plataformas siguen.
- Headers de navegador real, cookies de la sesión anónima que mande cada sitio durante la
  búsqueda, y palabras clave empezando por las que llevan más tiempo sin buscarse.

Aplicar lo haces tú, con tu cuenta y desde tu navegador.
