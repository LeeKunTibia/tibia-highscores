import * as fs from 'node:fs/promises';
import { characters } from './characters.mjs';

const achievementsMax = 1289;
const charmpointsMax = 21860;
const bosspointsMax = 24000;

const getPage = async(category, page) => {
    const response = await fetch(`https://api.tibiadata.com/v3/highscores/all/${category}/all/${page}`);
    const data = await response.json();        
    const highscoresList = data.highscores.highscore_list;
	return highscoresList;
}

const getData = async (category) => {
	console.log(`Fetching ${category} highscores.`);
    const pages = Array.from({length: 20}, (_, i) => i + 1);
    var allPages = [];
    for (let i = 1; i < 21; i++) {
        const page = await getPage(category, i);
        allPages = allPages.concat(page);
    }
    return allPages;
};

const achievementsData = await getData('achievements');
const charmpointsData = await getData('charmpoints');
const bosspointsData = await getData('bosspoints');

for await (var character of achievementsData) {
    if (characters.includes(character.name)) {
        character.value = character.value - 45;
    }
}

achievementsData.sort((a,b) => b.value - a.value);

var rank = 1;
for (let i = 1; i < achievementsData.length; i++) {  
    if (achievementsData[i].value < achievementsData[i - 1].value) {
        rank++;
        achievementsData[i].rank = rank;
    } else {
        achievementsData[i].rank = rank;
        rank++;
    }
}

var completionistData = [];
for (let i = 0; i < achievementsData.length; i++) {
    const character = achievementsData[i];
    character.achievementPoints = character.value;
    const charmsCharacter = charmpointsData.find(x => x.name == character.name);
    const bossessCharacter = bosspointsData.find(x => x.name == character.name);
    if (charmsCharacter) {
        character.charmPoints = charmsCharacter.value;
    } else {
        character.charmPoints = 0;
    }
    if (bossessCharacter) {
        character.bossPoints = bossessCharacter.value;
    } else {
        character.bossPoints = 0;
    }
    character.achievementsPct = Math.round(10000 * character.achievementPoints / achievementsMax) / 100;
    character.charmsPct = Math.round(10000 * character.charmPoints / charmpointsMax) / 100;
    character.bossesPct = Math.round(10000 * character.bossPoints / bosspointsMax) / 100;
    character.averagePct = Math.round(100 * (character.achievementsPct + character.charmsPct + character.bossesPct) / 3) / 100;
    completionistData.push(character);
}

completionistData.sort((a,b) => b.averagePct - a.averagePct);
completionistData[0].rank = 1;
rank = 1;
for (let i = 1; i < completionistData.length; i++) {  
    if (completionistData[i].averagePct < completionistData[i - 1].averagePct) {
        rank++;
        completionistData[i].rank = rank;
    } else {
        completionistData[i].rank = rank;
        rank++;
    }
}

const achievementsJson = JSON.stringify(achievementsData, null, '\t') + '\n';
await fs.writeFile(`./data/achievements.json`, achievementsJson);

const completionistsJson = JSON.stringify(completionistData, null, '\t') + '\n';
await fs.writeFile(`./data/completionists.json`, completionistsJson);