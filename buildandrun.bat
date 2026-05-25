@rem build images
docker-compose build
@rem start services
docker-compose up
@rem visit the frontend
open http://localhost:3000