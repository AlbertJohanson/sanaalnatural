# Brand Guidelines

## Paleta de Colores

### Colores principales
| Nombre | HEX | Uso |
|--------|---------|-----|
| Verde principal | `#55823d` | Color primario de marca. Fondos, botones principales, headers. |
| Verde oscuro | `#31591d` | Acentos, fondos oscuros, hover states, footers. |
| Verde claro | `#afea90` | Highlights, badges, fondos secundarios, CTAs suaves. |

### Colores neutros
| Nombre | HEX | Uso |
|--------|---------|-----|
| Blanco | `#ffffff` | Fondos, texto sobre colores oscuros, espacios en blanco. |
| Negro | `#000000` | Texto principal, iconos, bordes cuando se necesita alto contraste. |

### Variables CSS recomendadas
```css
:root {
  --color-primary: #55823d;
  --color-primary-dark: #31591d;
  --color-primary-light: #afea90;
  --color-white: #ffffff;
  --color-black: #000000;
}
```

---

## Tipografía

### Fuentes principales

La marca utiliza una combinación tipográfica equilibrada y legible:

1. **Noto Serif** — Títulos y palabras clave. Transmite confianza y cercanía.
2. **Zain** — Títulos alternativos y palabras clave.
3. **Poppins** — Textos descriptivos y cuerpo. Garantiza comunicación clara y accesible.

> **Nota legacy:** En materiales anteriores se usó **Times New Roman** (Regular y Bold) como tipografía principal y única. Para nuevos desarrollos, usar Noto Serif, Zain y Poppins.

### Jerarquía tipográfica recomendada

```css
/* Títulos principales */
h1, h2 {
  font-family: 'Noto Serif', serif;
  font-weight: 700;
}

/* Títulos secundarios / alternativos */
h3, h4 {
  font-family: 'Zain', serif;
  font-weight: 600;
}

/* Cuerpo de texto, párrafos, descripciones */
body, p, span, li {
  font-family: 'Poppins', sans-serif;
  font-weight: 400;
}
```

### Imports (Google Fonts)
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```
> **Nota:** Zain puede no estar disponible en Google Fonts. Verificar disponibilidad o usar como font local.

---

## Reglas generales de diseño

- **Tono visual:** Natural, orgánico, confiable.
- **Predominancia del verde:** El verde principal (#55823d) debe ser el color dominante en la identidad visual.
- **Contraste:** Usar blanco para texto sobre fondos verdes. Usar negro solo cuando se necesite máximo contraste.
- **Verde claro (#afea90):** Usar con moderación como acento, nunca como color dominante.
- **Espaciado:** Mantener generoso white space para transmitir limpieza y profesionalismo.
