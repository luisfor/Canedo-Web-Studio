# Datos Estructurados (JSON-LD)

Este proyecto (el kit y sus derivados) sigue estrictamente las especificaciones de **Schema.org** a través de **JSON-LD**. 

La estrategia de estructuración se basa en los siguientes principios:

1. **Inyección Limpia**: Todo el JSON-LD se inyecta utilizando `<script type="application/ld+json">`. NO se utilizan librerías de terceros (React Helmet, Next SEO, etc.) ni se inyectan etiquetas al vuelo en cliente.
2. **Uso de `@graph`**: Para evitar duplicidad de entidades y construir relaciones claras, todos los objetos se colocan en un nodo raíz `@graph`.
3. **Referencias Cruzadas (`@id`)**: Cada entidad (ej. Organization, WebSite, Blog, BlogPosting) define un único `@id`. Las relaciones como `publisher`, `author`, o `isPartOf` apuntan hacia esos `@id` en lugar de anidar objetos completos y correr el riesgo de duplicación.
4. **Dominio Desnudo**: Salvo que la redirección principal sea explícitamente distinta, se prefiere siempre el dominio desnudo (ej. `https://dominio.com/` en lugar de `https://www.dominio.com/`).
5. **Alineación de Canonical y Main Entity**: `mainEntityOfPage` debe reflejar la URL definida en el `<link rel="canonical">` de la página.

## Patrones Estándar

### 1. HOME (`index.html`)

El Home establece las entidades primarias del proyecto: la Organización y el Sitio Web. Si se aplica, también los Servicios.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://{{DOMAIN}}/#organization",
      "name": "{{BUSINESS_NAME}}",
      "url": "https://{{DOMAIN}}/",
      "logo": "https://{{DOMAIN}}/assets/img/logo.png"
    },
    {
      "@type": "WebSite",
      "@id": "https://{{DOMAIN}}/#website",
      "url": "https://{{DOMAIN}}/",
      "name": "{{BUSINESS_NAME}}",
      "publisher": {
        "@id": "https://{{DOMAIN}}/#organization"
      }
    }
  ]
}
```

### 2. BLOG (Archivo Principal / Índice)

Las páginas de índices (listados de posts) definen el `Blog` y las migas de pan (`BreadcrumbList`). **Es imperativo re-definir o referenciar adecuadamente la Organización.**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://{{DOMAIN}}/#organization",
      "name": "{{BUSINESS_NAME}}",
      "url": "https://{{DOMAIN}}/"
    },
    {
      "@type": "Blog",
      "@id": "https://{{DOMAIN}}/blog#blog",
      "url": "https://{{DOMAIN}}/blog",
      "name": "Insights — {{BUSINESS_NAME}}",
      "publisher": {
        "@id": "https://{{DOMAIN}}/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://{{DOMAIN}}/blog#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://{{DOMAIN}}/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": "https://{{DOMAIN}}/blog"
        }
      ]
    }
  ]
}
```

### 3. ARTÍCULOS INDIVIDUALES (Páginas Dinámicas)

Para páginas individuales como artículos de blog (e.g. `functions/insights/[slug].js`), además del `BlogPosting` y el `BreadcrumbList`, se deben inyectar mínimamente las entidades `Organization` y `Blog` (para que los `@id` resuelvan en la propia página).

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://{{DOMAIN}}/#organization",
      "name": "{{BUSINESS_NAME}}",
      "url": "https://{{DOMAIN}}/"
    },
    {
      "@type": "Blog",
      "@id": "https://{{DOMAIN}}/blog#blog",
      "url": "https://{{DOMAIN}}/blog",
      "name": "Insights — {{BUSINESS_NAME}}",
      "publisher": {
        "@id": "https://{{DOMAIN}}/#organization"
      }
    },
    {
      "@type": "BlogPosting",
      "@id": "https://{{DOMAIN}}/blog/slug-ejemplo#article",
      "headline": "Título del Artículo",
      "url": "https://{{DOMAIN}}/blog/slug-ejemplo",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://{{DOMAIN}}/blog/slug-ejemplo"
      },
      "author": { "@id": "https://{{DOMAIN}}/#organization" },
      "publisher": { "@id": "https://{{DOMAIN}}/#organization" },
      "isPartOf": { "@id": "https://{{DOMAIN}}/blog#blog" }
    }
  ]
}
```

## Validación
Todo archivo JSON-LD será validado localmente a través de `scripts/validate.js`, que comprobará:
- Parseo estricto del JSON.
- Ausencia de prefijos `www.` (donde aplique).
- Coincidencia de `canonical` y `mainEntityOfPage`.
- Singularidad de los atributos `@id`.
