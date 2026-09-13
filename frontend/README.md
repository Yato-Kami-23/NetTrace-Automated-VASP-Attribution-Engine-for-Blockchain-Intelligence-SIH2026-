# NetTrace — VASP Attribution Engine (React Frontend)

Automated blockchain intelligence and VASP attribution engine frontend built with **React (Vite + Javascript)**, featuring an interactive node-graph path visualizer, radial confidence meters, color-coded forensic threat chips, and real-time trace radar progress.

## Prerequisites

- Node.js (v18+)
- Python 3.10+ with FastAPI, Uvicorn, NetworkX, and Requests

---

## 1. Run the Backend

From the project root directory:

```bash
uvicorn api:app --reload --port 8080
```

> **Note on CORS:** If accessing the frontend outside the Vite proxy server or across different hosts/origins, ensure CORS is enabled in `api.py` for the Vite origin (`http://localhost:5173`):
> ```python
> from fastapi.middleware.cors import CORSMiddleware
>
> app.add_middleware(
>     CORSMiddleware,
>     allow_origins=["http://localhost:5173"],
>     allow_credentials=True,
>     allow_methods=["*"],
>     allow_headers=["*"],
> )
> ```

---

## 2. Run the Frontend

From the `frontend` directory:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## Features & Preserved Behaviors

1. **Suspect Wallet Input & Preset Targets**: Input any suspect wallet address (or 1-click test with preset targets like Tornado Cash or Binance).
2. **Dynamic Hop Limit**: Set a search limit from 1 to 10 hops (default: 4), or disable limit for full exhaustive search.
3. **Real-Time Trace Progress**: Displays animated radar scanner, live nodes explored counter, active node being evaluated, and an immediate `Stop Trace` button.
4. **Visual Node Graph**: Powered by `@xyflow/react` to render full transaction hops with visually distinct suspect origin, mixer tumblers (pulsing red), intermediaries, and identified VASP destination nodes.
5. **Radial Confidence Meter**: Color-graded SVG radial gauge indicating attribution certainty score and category.
6. **Forensic Mixer Detection**: Prominent warning banner detailing mixer entities identified, addresses, chains, and distance from suspect.
7. **Typology & Risk Flags**: Color-coded chips indicating laundering typologies (e.g. layering, mixer interaction) and sanctioned risk alerts.
8. **Explainable Report**: Expandable plain-text forensic report with 1-click clipboard copy and `.txt` file download (`attribution_report_{wallet}.txt`).
9. **Trace Reset**: Start New Trace button to cleanly reset session state.
