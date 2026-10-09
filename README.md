# heu

**Jouer : https://heu-uqsr.onrender.com/**

Ouvrez cette même adresse avec vos amis. Rien à installer ni à lancer sur vos postes.

![Aperçu du monde partagé](docs/preview.jpg)

Un petit monde partagé, dans le navigateur. Choisissez un pseudo et retrouvez-vous sur la même carte. Aucun compte, aucun salon à créer, aucune règle de jeu.

## Pour jouer

Ouvrez l'adresse du service avec votre ami. Votre pseudo est demandé une seule fois et enregistré dans ce navigateur. Déplacements avec ZQSD, WASD, les flèches ou le joystick tactile. Cliquez sur votre pseudo pour le changer.

La dernière position est enregistrée régulièrement. Un rafraîchissement rejoint directement le monde. Si vous ouvrez deux onglets sur le même navigateur, le dernier reprend votre personnage.

## Architecture

- **Client :** TypeScript, Canvas 2D, sprites originaux animés en pixel art ; esbuild produit un petit fichier JavaScript.
- **Serveur :** Node.js 24 et WebSocket (`ws`), simulation à 40 Hz, état envoyé à 20 Hz, déplacements contrôlés par le serveur.
- **Monde :** une seule carte, un seul processus, une seule réplique. Pas de base de données pour cette première version.
- **Fluidité :** déplacement local immédiat, correction progressive, interpolation des autres joueurs et caméra amortie.
- **Identité :** identifiant aléatoire et pseudo enregistrés en local, sans authentification. Le pseudo ne prouve pas l'identité d'une personne.

```
client/     interface, connexion, commandes et rendu
server/     HTTP, WebSocket et simulation du monde
shared/     carte, déplacements et types du protocole
assets/     sprites originaux, générés dans un atlas Canvas
scripts/    préparation des fichiers servis
tests/      déplacements et session multijoueur réelle
```

## Déploiement gratuit sur Render

[Déployer heu sur Render](https://render.com/deploy?repo=https://github.com/tdi-rosa/heu)

Le fichier `render.yaml` prépare un unique service **Free**, en Europe, connecté à `main`. Aucune variable secrète, base de données ou installation sur les postes des joueurs. Une fois le service lancé, partager son adresse HTTPS avec les amis.

Chaque commit sur `main` déclenche automatiquement le build et le déploiement. Le client utilise le SHA de la version Render pour recharger les pages après une mise à jour, tout en gardant le pseudo et la dernière position dans le navigateur.

Le service gratuit s'endort après 15 minutes sans trafic entrant. Son réveil prend environ une minute. Les messages WebSocket des joueurs le maintiennent actif pendant la partie. Les quotas gratuits de Render s'appliquent ; ne sélectionner aucune offre payante.

## Déploiement Railway (alternative)

Créer un service depuis le dépôt `tdi-rosa/heu`, branche `main`, puis générer un domaine public. `railway.toml` configure le build, le démarrage et `/health`. Node 24 est défini dans `package.json`. Le port est fourni par Railway. Aucune clé ni variable secrète n'est nécessaire.

Garder **une seule réplique**, sans mise en veille. Régler l'overlap des déploiements à **0 seconde** : deux processus simultanés feraient deux mondes indépendants. Le nouveau serveur est vérifié par `/health` avant la bascule.

Activer les déploiements automatiques depuis `main`. Chaque push reconstruit le service. Les réponses HTTP utilisent `Cache-Control: no-store`. Le client vérifie la version et se recharge après confirmation d'une nouvelle version ; il retrouve son pseudo et sa position. Une fermeture WebSocket provoque une reconnexion automatique avec temporisation.

Un déploiement peut provoquer une courte interruption. Les sessions actives ne sont pas transférées entre processus : chaque navigateur rejoint le nouveau serveur automatiquement. La position provient alors de la dernière sauvegarde locale. Aucune promesse de remplacement de code sans interruption.

## Développement (facultatif)

Les joueurs n'ont rien à lancer sur leur ordinateur. Ces commandes servent uniquement aux contributeurs :

```sh
npm ci
npm run build
npm test
npm run dev
```

Ouvrir `http://localhost:3000`. Après une modification du client, relancer `npm run build` puis rafraîchir. Le serveur se relance avec `--watch`.

## Sprites et portée

Les personnages utilisent un atlas de 3 poses × 4 directions inspiré des RPG en vue du dessus. Personnages, arbres et terrain sont originaux, écrits dans ce dépôt, sans ressources propriétaires de RPG Maker. Aucune image ni police n'est chargée depuis un service externe.

Cette version contient uniquement : rejoindre, choisir un pseudo, se déplacer et voir les autres. La carte comporte quelques éléments de décor avec collision. Il n'y a ni chat, ni combat, ni inventaire, ni objectif.
