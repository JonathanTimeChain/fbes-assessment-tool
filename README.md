# FBES Self-Assessment Tool

A self-assessment tool for Bitcoin education providers to evaluate their curriculum against FBES (Foundation for Bitcoin Educational Standards) endorsement criteria.

## Features

- **8 Assessment Categories**: Technical accuracy, pedagogical quality, ethics, and more
- **50+ Evaluation Questions**: Detailed criteria aligned with FBES standards
- **User Accounts**: Save progress, resume later
- **Actionable Results**: Detailed scoring with prioritized recommendations

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: Vanilla HTML/CSS/JS
- **Auth**: JWT-based session management

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
cd backend
uvicorn main:app --reload --port 8891
```

Visit `http://localhost:8891`

## Deployment

This app is configured for one-click deployment on Render.com via `render.yaml`.

## License

© 2026 Foundation for Bitcoin Educational Standards. All rights reserved.
