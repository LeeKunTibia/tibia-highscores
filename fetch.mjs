import * as fs from 'node:fs/promises';
import { characters } from './characters.mjs';

const pageSearchLimit = 5;

//Achievements, Charm Points, Boss Points
const maxPoints = [1289, 21860, 24000];

const scoreBonusQuantile = 0.9;
const scoreBonusAmount = 1.25;
//Points beyond 90% of the max will have a 25% bonus on the Score

const bonusLimits = maxPoints.map(x => Math.round(x * scoreBonusQuantile));

const APIurl = 'https://api.tibiadata.com/v3';
//const APIurl = 'https://dev.tibiadata.com/v4';

const charLink = (name) => {
    const url = encodeURI(`https://www.tibia.com/community/?name=${name}`);
    return url;
}

const getWorlds = async () => {
	console.log('Getting list of Tibia worlds…');
	const response = await fetch(`${APIurl}/worlds`);
	const data = await response.json();
	const regularWorlds = data.worlds.regular_worlds;
	const worldNames = regularWorlds.map((world) => world.name);
	return worldNames;
};

const getPage = async(category, world, page) => {
    try {
        const response = await fetch(`${APIurl}/highscores/${world}/${category}/all/${page}`)
        const data = await response.json();
        if (data.error) {
            console.log(`Fetch of ${category} failed for ${world} page ${page}. Error received from Tibia.com.`);
            return [];
        } else if (data.information.status && data.information.status.http_code != 200) { //API V4 only
            console.log(`Fetch of ${category} failed for ${world} page ${page}. Error ${data.information.status.http_code}`);
            return [];
        } else {
            const highscoresList = data.highscores.highscore_list;
            if (highscoresList === null) {
                //Empty highscores, could be new world on launch day. 
                return [];
            } else {
                return highscoresList;
            }
        }
    } catch (error) {
        console.log(`Fetch of ${category} failed for ${world} page ${page}:\n${error}`);
        return [];
    }
}

const getDataForWorld = async (category, world) => {	
    const pages = Array.from({length: pageSearchLimit}, (_, i) => i + 1);
    const allPages = await Promise.all(pages.map((p) => getPage(category, world, p)));
    return allPages;
};

const getData = async (category, worlds) => {
    console.log(`Fetching ${category} highscores...`);
    var allData = await Promise.all(worlds.map((worldName) => getDataForWorld(category, worldName)));
    allData = await allData.flat(2);
    return allData;
}

const worldNames = await getWorlds();

var achievementsData = await getData('achievements', worldNames);
const charmpointsData = await getData('charmpoints', worldNames);
const bosspointsData = await getData('bosspoints', worldNames);

for await (var character of achievementsData) {
    if (characters.includes(character.name)) {
        //console.log(character.name);
        character.value = character.value - 45;
    }
}

const rankData = (data, key) => {
    data.sort((a,b) => b[key] - a[key]);
    var rank = 1;
    data[0].rank = 1;
    for (let i = 1; i < data.length; i++) {  
        if (data[i][key] < data[i - 1][key]) {
            rank++;
            data[i].rank = rank;
        } else {
            data[i].rank = rank;
            rank++;
        }
    }
    return data;
}

const getCharacterScore = (character) => {    
    const extraAchiev = character.achievementPoints - bonusLimits[0];
    const extraCharms = character.charmPoints - bonusLimits[1];
    const extraBosses = character.bossPoints - bonusLimits[2];

    var scoreAchiev = character.achievementPoints / maxPoints[0];
    if (extraAchiev > 0) {
        scoreAchiev = (extraAchiev * scoreBonusAmount + bonusLimits[0])/maxPoints[0];
    }    
    var scoreCharms = character.charmPoints / maxPoints[1];
    if (extraCharms > 0) {
        scoreCharms = (extraCharms * scoreBonusAmount + bonusLimits[1])/maxPoints[1];
    }    
    var scoreBosses = character.bossPoints / maxPoints[2];
    if (extraBosses > 0) {
        scoreBosses = (extraBosses * scoreBonusAmount + bonusLimits[2])/maxPoints[2];
    }
    const score = Math.round((scoreAchiev + scoreCharms + scoreBosses) * 10000) / 100;
    return score;
}

achievementsData = await rankData(achievementsData, 'value');
var completionistData = [];

const achievementsDataClone = structuredClone(achievementsData);
console.log("Processing data...");
for (let i = 0; i < achievementsDataClone.length; i++) {
    const character = achievementsDataClone[i];
    character.achievementPoints = character.value;
    delete character.value;
    const charmsCharacter = charmpointsData.find(x => x.name == character.name);
    const bossessCharacter = bosspointsData.find(x => x.name == character.name);
    const charUrl = encodeURI(`https://www.tibia.com/community/?name=${character.name}`) + `||${character.name}`;
    character.name = charUrl;
    achievementsData[i].name = charUrl;
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
    character.achievementsPct = Math.round(10000 * character.achievementPoints / maxPoints[0]) / 100;
    character.charmsPct = Math.round(10000 * character.charmPoints / maxPoints[1]) / 100;
    character.bossesPct = Math.round(10000 * character.bossPoints / maxPoints[2]) / 100;
    character.averagePct = Math.round(100 * (character.achievementsPct + character.charmsPct + character.bossesPct) / 3) / 100;
    //character.score = getCharacterScore(character);

    delete character.achievementsPct;
    delete character.charmsPct;
    delete character.bossesPct;
    
    completionistData.push(character);
}

completionistData = await rankData(completionistData, 'averagePct');

completionistData = completionistData.filter(x => x.rank <= 1000);
achievementsData = achievementsData.filter(x => x.rank <= 1000);

console.log("Saving data to JSON files...")
const achievementsJson = JSON.stringify(achievementsData, null, '\t') + '\n';
await fs.writeFile(`./data/achievements.json`, achievementsJson);

const completionistsJson = JSON.stringify(completionistData, null, '\t') + '\n';
await fs.writeFile(`./data/completionists.json`, completionistsJson);
console.log("Process complete.")