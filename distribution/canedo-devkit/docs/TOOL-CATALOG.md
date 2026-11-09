# Catálogo de herramientas — fase C

Estado: catálogo de metadatos implementado. No contiene instaladores ni ejecuta planes de cambios.

## Consultas

```bash
npm run kit:tools -- list
npm run kit:tools -- list --kind database-client --json
npm run kit:tools -- show go --json
npm run kit:tools -- dependencies govulncheck --json
npm run kit:tools -- validate --json
npm run kit:validate
```

Las consultas leen archivos locales y no invocan CLIs de terceros, descargan paquetes ni consultan servicios. Funcionan sin una API de IA y sin herramientas de desarrollo adicionales en PATH, siempre que Node y las dependencias npm del propio kit estén disponibles.

Los comandos anteriores amplían el CLI existente. `kit:catalog` sigue mostrando skills y perfiles; `kit:doctor` sigue diagnosticando las herramientas seleccionadas. No existe todavía un ejecutable global `devkit`.

## Archivos y contratos

- [Manifiesto](../catalog/tools/manifest.json): esquema 1, catálogo 1.0.0.
- [JSON Schema](../schemas/tool-catalog.schema.json): validación mediante AJV, ya incluido en el kit.
- [Cargador y validación semántica](../scripts/tools/catalog.js).
- [Pruebas del catálogo](../tests/kit/tool-catalog.test.js).
- [Catálogo anterior](../config/kit-capabilities.json): conserva sus 11 skills, 24 perfiles y 20 diagnósticos originales.

El catálogo nuevo añade metadatos a los diagnósticos existentes y a Git/Go. La validación rechaza divergencias de comandos entre ambos archivos, de modo que una actualización no cambie silenciosamente un diagnóstico heredado. No se migraron ni eliminaron perfiles.

## Qué significa cada entrada

| Campo | Significado |
|---|---|
| `id`, `label`, `kind` | Identidad y categoría: runtime, SDK, servicio, cliente, paquete de proyecto, etc. |
| `availability` | `diagnostic`: tiene comprobación implementada; `documented`: solo descripción y relaciones |
| `diagnostic` | Comando y argumentos de consulta limitados; no una receta de instalación |
| `versionPolicy` | Regla explícita con evidencia y fecha, o estado `unassessed` |
| `sources` | Documentación de referencia; no acredita integridad de un binario |
| `dependencies` | Dependencias obligatorias del flujo descrito |
| `optionalDependencies` | Relaciones condicionales que no se seleccionan automáticamente |
| `conflicts` | Incompatibilidades declaradas; vacío cuando no hay evidencia de conflicto |
| `platforms` | Restricción explícita cuando procede; su ausencia no garantiza soporte en todas las plataformas |

El conjunto inicial tiene **80 entradas: 22 con diagnóstico y 58 documentadas**. Una CLI como Flutter puede estar implementada como diagnóstico y aun así devolver `unverifiable`: su presencia no autoriza inicializar el SDK. Los gestores documentados pueden aparecer por presencia en el doctor, sin que se ejecute su versión ni un instalador.

## Reglas de versión iniciales

| Herramienta | Regla del catálogo | Alcance |
|---|---|---|
| Node.js | Mínimo 22.20; ramas 22, 24 y 26 | Política del kit basada en ramas LTS revisadas y requisitos de su flujo de skills |
| Python | Desde 3.11 y anterior a 3.16 | Ventana de ramas con soporte oficial consultada |
| Go | Desde 1.26 y anterior a 1.28 | Ventana de ramas soportadas según la política de Go consultada |

Las políticas se revisaron el **1 de noviembre de 2026** y no se actualizan solas. No son una certificación de cada combinación de framework/OS ni garantizan que un parche sea reciente o seguro. Para los demás casos se conserva `unassessed`, sin inventar un rango universal. Una versión específica de Spring Boot, Angular, Flutter o un driver puede imponer requisitos adicionales.

El doctor usa estas reglas y añade `toolCatalogVersion` a su salida. Por ejemplo, Node 25 queda fuera de la política declarada; se informa y no se sustituye automáticamente. Sin `--strict` sigue siendo informativo; con `--strict` causa salida 1.

`updateStatus` permanece `not-checked`: esta fase no consulta versiones nuevas ni escanea vulnerabilidades.

Fuentes de las políticas: [Node.js](https://nodejs.org/en/about/previous-releases), [Skills CLI](https://github.com/vercel-labs/skills), [Python](https://devguide.python.org/versions/) y [Go](https://go.dev/doc/devel/release).

## Dependencias sin instalaciones implícitas

`tools dependencies` muestra dependencias directas, el conjunto transitivo obligatorio, relaciones opcionales y conflictos. No determina versiones concretas ni escoge un gestor automáticamente. La [fase D](INSTALLATION-PLANNER.md) combina estos metadatos con el diagnóstico para generar propuestas revisables, todavía sin recetas ejecutables.

Ejemplos:

- npm requiere Node para ejecutarse; consultar npm no instala Node.
- govulncheck requiere Go; recomendarlo opcionalmente desde Go no lo convierte en requisito del toolchain.
- Flutter puede requerir Android SDK o Xcode según el target, sin instalar ambos de oficio.
- `postgresql` representa el cliente psql y `postgresql-server` un servicio separado. El servidor podría estar en otra máquina o en un contenedor.
- React, Vue y otros frameworks figuran como paquetes por proyecto, sin instaladores globales ni generadores nuevos.
- No se declara que Terraform/OpenTofu o Docker/otras alternativas sean incompatibles por estar instalados juntos. La propiedad de recursos se validará en el contexto del proyecto.

## Controles de validación

La validación comprueba:

- Esquema/versiones conocidas, campos permitidos, IDs y fuentes HTTPS sin credenciales ni parámetros.
- Fechas válidas, evidencia declarada y rangos numéricos con intersección posible.
- Referencias, duplicados y ausencia de autorreferencias.
- Ciclos de dependencias obligatorias; las relaciones opcionales no fuerzan instalaciones.
- Conflictos transitivos y ausencia de una plataforma común entre dependencias obligatorias.
- Compatibilidad de comandos con los diagnósticos heredados.
- Combinaciones de argumentos de versión seguras. Por ejemplo, `python version` se rechaza: Python podría interpretar `version` como un archivo.

Los campos de instalación, scripts de shell y otros datos no previstos son rechazados. Los errores no incluyen valores del manifiesto ni contenido JSON en bruto. Antes del diagnóstico, un manifiesto inválido bloquea su uso.

La comprobación de URLs es sintáctica: no verifica propiedad del dominio, disponibilidad, firmas ni hashes. La [fase E manual](COMMAND-INSTALLATION.md) añade adaptadores de comandos y conserva los snapshots oficiales Go/Node/Terraform con ejecución pública deshabilitada. `install coverage` distingue cobertura manual y formatos históricos; ninguna acredita instalaciones.

## Extender y mantener

1. Añadir una entrada con ID único, categoría, descripción y fuentes pertinentes.
2. Declarar relaciones reales y dejar versiones como `unassessed` si no hay evidencia suficiente.
3. Usar `documented` si no hay diagnóstico probado; no añadir comandos de instalación.
4. Actualizar `catalogVersion` y `updatedAt`; cambios incompatibles de formato requieren una versión de esquema nueva y su estrategia de migración.
5. Ejecutar `npm run kit:validate` y `npm run test:kit`.
6. Registrar el cambio y conservar la distinción entre documentación y soporte probado.

Las pruebas cubren esquema, grafos, reglas y regresiones del CLI. Se ejecutaron en macOS ARM64; los casos de otras plataformas siguen siendo simulados. No se ha certificado una instalación de las 80 herramientas.

## Fuera de esta fase

Ejecución de planes, selección automática de paquetes/versiones, instaladores, cambios de PATH, elevación de privilegios, actualización/reparación, registro de propiedad y reproducción del entorno. Tampoco se añaden arquetipos o generadores Go por incorporar sus metadatos.

## Índice de entradas

| Herramienta | Categoría | Estado | Fuente |
|---|---|---|---|
| `node` — Node.js | runtime | diagnostic | [Documentación](https://nodejs.org/en/about/previous-releases) |
| `npm` — npm | package-manager | diagnostic | [Documentación](https://docs.npmjs.com/) |
| `java` — Java | runtime | diagnostic | [Documentación](https://dev.java/learn/) |
| `dotnet` — .NET | runtime | diagnostic | [Documentación](https://learn.microsoft.com/dotnet/) |
| `python` — Python | runtime | diagnostic | [Documentación](https://devguide.python.org/versions/) |
| `adb` — Android Debug Bridge | utility | diagnostic | [Documentación](https://developer.android.com/tools/adb) |
| `flutter` — Flutter | sdk | diagnostic | [Documentación](https://docs.flutter.dev/) |
| `rust` — Rust | compiler | diagnostic | [Documentación](https://www.rust-lang.org/tools/install) |
| `c` — Compilador C | compiler | diagnostic | [Documentación](https://clang.llvm.org/docs/UsersManual.html) |
| `cpp` — Compilador C++ | compiler | diagnostic | [Documentación](https://clang.llvm.org/docs/UsersManual.html) |
| `cmake` — CMake | utility | diagnostic | [Documentación](https://cmake.org/documentation/) |
| `arduino` — Arduino CLI | utility | diagnostic | [Documentación](https://docs.arduino.cc/arduino-cli/) |
| `sqlite` — SQLite CLI | database-client | diagnostic | [Documentación](https://sqlite.org/cli.html) |
| `postgresql` — PostgreSQL psql | database-client | diagnostic | [Documentación](https://www.postgresql.org/docs/current/app-psql.html) |
| `mysql` — Cliente MySQL/MariaDB | database-client | diagnostic | [Documentación](https://dev.mysql.com/doc/refman/en/mysql.html) |
| `sqlserver` — SQL Server sqlcmd | database-client | diagnostic | [Documentación](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility) |
| `oracle` — Oracle SQL*Plus | database-client | diagnostic | [Documentación](https://docs.oracle.com/en/database/oracle/oracle-database/) |
| `terraform` — Terraform | infrastructure | diagnostic | [Documentación](https://developer.hashicorp.com/terraform/docs) |
| `pulumi` — Pulumi | infrastructure | diagnostic | [Documentación](https://www.pulumi.com/docs/iac/) |
| `docker` — Docker CLI | infrastructure | diagnostic | [Documentación](https://docs.docker.com/) |
| `git` — Git | utility | diagnostic | [Documentación](https://git-scm.com/doc) |
| `go` — Go | compiler | diagnostic | [Documentación](https://go.dev/doc/devel/release) |
| `winget` — WinGet | package-manager | documented | [Documentación](https://learn.microsoft.com/windows/package-manager/winget/) |
| `homebrew` — Homebrew | package-manager | documented | [Documentación](https://docs.brew.sh/Installation) |
| `apt` — APT | package-manager | documented | [Documentación](https://manpages.debian.org/apt) |
| `dnf` — DNF | package-manager | documented | [Documentación](https://dnf.readthedocs.io/) |
| `pnpm` — pnpm | package-manager | documented | [Documentación](https://pnpm.io/installation) |
| `yarn` — Yarn | package-manager | documented | [Documentación](https://yarnpkg.com/getting-started/install) |
| `pip` — pip | package-manager | documented | [Documentación](https://pip.pypa.io/en/stable/) |
| `uv` — uv | package-manager | documented | [Documentación](https://docs.astral.sh/uv/) |
| `cargo` — Cargo | package-manager | documented | [Documentación](https://doc.rust-lang.org/cargo/) |
| `rustup` — rustup | package-manager | documented | [Documentación](https://rust-lang.github.io/rustup/) |
| `maven` — Maven | package-manager | documented | [Documentación](https://maven.apache.org/install.html) |
| `gradle` — Gradle | package-manager | documented | [Documentación](https://docs.gradle.org/current/userguide/compatibility.html) |
| `php` — PHP | runtime | documented | [Documentación](https://www.php.net/manual/en/install.php) |
| `ruby` — Ruby | runtime | documented | [Documentación](https://www.ruby-lang.org/en/documentation/installation/) |
| `dart` — Dart | runtime | documented | [Documentación](https://dart.dev/get-dart) |
| `swift` — Swift | compiler | documented | [Documentación](https://www.swift.org/install/) |
| `kotlin` — Kotlin | compiler | documented | [Documentación](https://kotlinlang.org/docs/command-line.html) |
| `kubectl` — kubectl | infrastructure | documented | [Documentación](https://kubernetes.io/docs/tasks/tools/) |
| `helm` — Helm | infrastructure | documented | [Documentación](https://helm.sh/docs/intro/install/) |
| `opentofu` — OpenTofu | infrastructure | documented | [Documentación](https://opentofu.org/docs/intro/install/) |
| `ansible` — Ansible | infrastructure | documented | [Documentación](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) |
| `android-sdk` — Android SDK | sdk | documented | [Documentación](https://developer.android.com/tools) |
| `android-studio` — Android Studio | ide | documented | [Documentación](https://developer.android.com/studio/install) |
| `xcode` — Xcode | ide | documented | [Documentación](https://developer.apple.com/support/xcode/) |
| `esp-idf` — ESP-IDF | sdk | documented | [Documentación](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/) |
| `platformio` — PlatformIO | utility | documented | [Documentación](https://docs.platformio.org/en/latest/core/installation/index.html) |
| `arduino-ide` — Arduino IDE | ide | documented | [Documentación](https://docs.arduino.cc/software/ide/) |
| `golangci-lint` — golangci-lint | quality | documented | [Documentación](https://golangci-lint.run/docs/welcome/install/) |
| `govulncheck` — govulncheck | quality | documented | [Documentación](https://go.dev/doc/security/vuln/) |
| `gitleaks` — Gitleaks | quality | documented | [Documentación](https://github.com/gitleaks/gitleaks) |
| `trivy` — Trivy | quality | documented | [Documentación](https://trivy.dev/latest/docs/) |
| `postgresql-server` — Servidor PostgreSQL | database-service | documented | [Documentación](https://www.postgresql.org/docs/current/installation.html) |
| `mysql-server` — Servidor MySQL | database-service | documented | [Documentación](https://dev.mysql.com/doc/refman/en/installing.html) |
| `mariadb` — Servidor MariaDB | database-service | documented | [Documentación](https://mariadb.com/docs/server) |
| `mongodb` — MongoDB | database-service | documented | [Documentación](https://www.mongodb.com/docs/manual/installation/) |
| `redis` — Redis | database-service | documented | [Documentación](https://redis.io/docs/latest/operate/oss_and_stack/install/) |
| `typescript` — TypeScript | project-package | documented | [Documentación](https://www.typescriptlang.org/download/) |
| `react` — React | project-package | documented | [Documentación](https://react.dev/learn/creating-a-react-app) |
| `nextjs` — Next.js | project-package | documented | [Documentación](https://nextjs.org/docs/app/getting-started/installation) |
| `vue` — Vue | project-package | documented | [Documentación](https://vuejs.org/guide/quick-start.html) |
| `nuxt` — Nuxt | project-package | documented | [Documentación](https://nuxt.com/docs/getting-started/installation) |
| `angular` — Angular | project-package | documented | [Documentación](https://angular.dev/installation) |
| `svelte` — Svelte | project-package | documented | [Documentación](https://svelte.dev/docs/kit/creating-a-project) |
| `vite` — Vite | project-package | documented | [Documentación](https://vite.dev/guide/) |
| `tailwind` — Tailwind CSS | project-package | documented | [Documentación](https://tailwindcss.com/docs/installation) |
| `nestjs` — NestJS | project-package | documented | [Documentación](https://docs.nestjs.com/) |
| `express` — Express | project-package | documented | [Documentación](https://expressjs.com/en/starter/installing.html) |
| `fastify` — Fastify | project-package | documented | [Documentación](https://fastify.dev/docs/latest/) |
| `fastapi` — FastAPI | project-package | documented | [Documentación](https://fastapi.tiangolo.com/) |
| `django` — Django | project-package | documented | [Documentación](https://docs.djangoproject.com/) |
| `flask` — Flask | project-package | documented | [Documentación](https://flask.palletsprojects.com/en/stable/) |
| `springboot` — Spring Boot | project-package | documented | [Documentación](https://docs.spring.io/spring-boot/system-requirements.html) |
| `aspnetcore` — ASP.NET Core | project-package | documented | [Documentación](https://learn.microsoft.com/aspnet/core/) |
| `laravel` — Laravel | project-package | documented | [Documentación](https://laravel.com/docs/installation) |
| `chi` — Chi | project-package | documented | [Documentación](https://github.com/go-chi/chi) |
| `gin` — Gin | project-package | documented | [Documentación](https://gin-gonic.com/docs/) |
| `echo` — Echo | project-package | documented | [Documentación](https://echo.labstack.com/docs) |
| `fiber` — Fiber | project-package | documented | [Documentación](https://docs.gofiber.io/) |
