<h1 align="center">vlresports - Valorant Esports API</h1>

<p align="center">
  <img src="https://i.imgur.com/YEjo9XY.png" width="180px" alt="Valorant Competitive API" />
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0">
    <img src="https://img.shields.io/github/license/orloxx23/vlresports?style=for-the-badge
" alt="License" />
  </a>
  <a href="https://github.com/Orloxx23/vlresports/stargazers">
    <img src="https://img.shields.io/github/stars/orloxx23/vlresports?style=for-the-badge
" alt="GitHub stars" />
  </a>
  <a href="https://github.com/Orloxx23/vlresports/network">
    <img src="https://img.shields.io/github/forks/orloxx23/vlresports?style=for-the-badge
" alt="GitHub forks" />
  </a>
  <a href="https://github.com/Orloxx23/vlresports/issues">
    <img src="https://img.shields.io/github/issues/orloxx23/vlresports?style=for-the-badge
" alt="GitHub issues" />
  </a>
  <img alt="Status" src="https://img.shields.io/website?url=https%3A%2F%2Falert-puce-neckerchief.cyclic.app%2F&style=for-the-badge&label=status"/>

</p>

<p align="center">
  <a href="https://ko-fi.com/L3L1NNH7E" target="_blank"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" /></a>
</p>

<p align="center">
  <strong>vlresports</strong> is an open-source project that aims to provide a scraping API for the vlr.gg website to gather information about players and teams in the competitive Valorant scene. Please note that this project is not associated with vlr.gg or Riot Games.
</p>

## 📖 Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Introduction

**vlresports** is designed to facilitate access to essential data from the competitive Valorant scene. By scraping vlr.gg, it allows users to retrieve information about professional players, teams, and other relevant statistics. The goal of this project is to make it easier for developers and enthusiasts to access and utilize data for their applications, analysis, or research related to Valorant esports.

## ✨ Features

- Scraping data from vlr.gg efficiently and securely.
- Providing a simple and intuitive API to access player and team information.
- Regular updates to keep the data current and relevant.
- Lightweight and easy to integrate into other projects.

## ⚙️ Installation

To install vlresports, follow these steps:

1. Clone the repository to your local machine.
2. Install the necessary dependencies using `npm`.
3. Run the API server locally or deploy it to your preferred hosting platform.

```bash
git clone https://github.com/Orloxx23/vlresports.git
```

```bash
cd vlresports
```

```bash
npm install
```

```bash
npm start
```

## 🎯 Usage

Once you have the API server up and running, you can interact with it using HTTP requests. The API provides endpoints for accessing players' and teams' data. Here's a basic example of how to use the API with cURL:

```bash
# Get information about a specific player
curl -X GET http://localhost:5000/api/v1/players/{player_id}

# Get information about a specific team
curl -X GET http://localhost:5000/api/v1/teams/{team_id}
```

Please refer to the <a href="https://vlresports.vercel.app">API documentation</a> for more detailed usage instructions and examples. You can also try out the API using the interactive documentation provided by <a href="https://app.swaggerhub.com/apis-docs/Orloxx23/Valorant-Esports/" target="_blank">Swagger UI</a>.

## 📚 API Endpoints

The following are the main endpoints provided by the API:

- `GET /api/v1/players`: Retrieve information about all players.
- `GET /api/v1/players/{player_id}`: Retrieve information about a specific player.
- `GET /api/v1/teams`: Retrieve information about all teams.
- `GET /api/v1/teams/{team_id}`: Retrieve information about a specific team.

## 🤝 Contributing

Contributions to vlresports are welcome and greatly appreciated. If you wish to contribute, please follow the guidelines outlined in the [CONTRIBUTING.md](https://github.com/Orloxx23/vlresports/blob/main/CONTRIBUTING.md) file.

## 📝 License

vlresports is open-source and available under the [Apache 2.0 License](https://github.com/Orloxx23/vlresports/blob/main/LICENSE).

---

We hope you find vlresports useful for your Valorant esports-related projects. If you have any questions, suggestions, or issues, feel free to raise them in the GitHub repository's issue tracker. Happy coding!
