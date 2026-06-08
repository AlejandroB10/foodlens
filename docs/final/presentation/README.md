# FoodLens — Presentación final (25 min)

Presentación para la evaluación del **9 de junio** (curso 11755, HCI, UIB). Cubre los 6 puntos obligatorios de la rúbrica y la presentan los 4 miembros del equipo.

## Ficheros

| Fichero | Qué es |
|---|---|
| `slides.md` | **La fuente.** Aquí se edita todo el contenido y las notas del orador. |
| `slides.pptx` | El deck para presentar (tema beamer Singapore/dolphin) **con las notas del orador**. |
| `slides.pdf` | El mismo deck en PDF (por si el aula no abre `.pptx`). |
| `build.sh` / `build_pptx.py` | Generan `slides.pdf` y `slides.pptx` desde `slides.md`. |
| `figs/` | Capturas reales del dashboard usadas en el deck. |

## Cómo modificar la presentación

1. Editá **`slides.md`** (un slide por `##`, secciones con `#`).
2. Las **notas del orador** van en bloques `::: notes ... :::` y **empiezan con el nombre** del que presenta ese slide (`**Alejandro Bordón:** ...`).
3. Regenerá los entregables:

```bash
./build.sh
```

Esto produce `slides.pdf` y `slides.pptx`.

## Requisitos del build

- `pandoc` + un motor LaTeX (`pdflatex`)
- `pdftoppm` (paquete `poppler-utils`)
- `python3` con `python-pptx`  →  `pip install python-pptx`

## Por qué el pptx se monta con imágenes

`pandoc` aplica los temas de beamer (Singapore/dolphin) **solo al PDF**, no a su `.pptx` nativo. Para tener ese look en `.pptx`, `build.sh` convierte cada página del beamer a imagen y monta el `.pptx` con una imagen por slide **+ las notas del orador** (parseadas de `slides.md`). Consecuencia: el **texto de los slides no es editable** en PowerPoint — para cambiar contenido se edita `slides.md` y se re-corre `./build.sh`. Las **notas sí son texto** editable.

## Reparto (los 4 presentan)

| Sección | Presenta |
|---|---|
| 1. Design process & rationale | Alejandro Bordón |
| 2. XAI methods selection | Soufyane Youbi |
| 3. Key insights from user testing | Alejandro Rodríguez |
| 4. Technical & design challenges | Pau Girón |
| 5. Live demonstration (≈8 min) | Alejandro Rodríguez conduce; todos participan |
| 6. Lessons learned & future | Alejandro Bordón |

> La **demostración en vivo** va al final, justo antes de las conclusiones.
