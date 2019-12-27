# yawarakai-helper

This is for the helper script which runs standalone besides Yawarakai it self.
The goal of this seperated repository is to make the useful script that may help the Yawarakai user or the other project.    
Currently include:
- NLP modules and several initial algroithm
- Log parser to parse log to database
- Log translate to make message log out to database with nlp
- Few training model for indexing

## Usage
### Installation
```
git clone https://github.com/hanamiyuna/yawarakai-helper.git
cd yawarakai-helper
yarn install
```
### Log parse
Parse the log from yawarakai and save it to a database file using NeDB
```
node ./log/parser.js
```
database file will be saved to `./log/history.db`