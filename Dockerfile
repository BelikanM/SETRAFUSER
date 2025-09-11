# Étape 1 : Build React app
FROM node:20 AS build

WORKDIR /app

# Copier uniquement les fichiers package pour installer les dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --legacy-peer-deps

# Copier le reste du projet et build React
COPY . .
RUN npm run build

# Étape 2 : Serveur Nginx pour la prod
FROM nginx:stable-alpine

# Copier le build React dans le répertoire Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copier la config Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80
EXPOSE 80

# Lancer Nginx en avant-plan
CMD ["nginx", "-g", "daemon off;"]
