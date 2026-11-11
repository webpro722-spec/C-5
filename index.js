const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// ⚙️ 설정값
// ==========================================
const BOT_TOKEN = ""; // <-- 여기에 토큰 입력
const REPORT_CHANNEL_ID = "1565880892155494501"; // 변동 보고서 채널 ID

// ==========================================
// 📊 메모리 데이터 저장소
// ==========================================
let botData = {
    company5: { officers: [], ncos: [], enlisted: [], total: 0, goal: "📌 실시간 연동 중" },
    company6: { officers: [], ncos: [], enlisted: [], total: 0, goal: "📌 실시간 연동 중" },
    summary: {
        c5: { new: 0, retired: 0, deserter: 0, out: 0, in: 0 },
        c6: { new: 0, retired: 0, deserter: 0, out: 0, in: 0 }
    }
};

const OFFICERS = ["소장", "준장", "대령", "중령", "소령", "대위", "중위", "소위", "준위"];
const NCOS = ["원사", "상사", "중사", "하사"];
const ENLISTED = ["병장", "상병", "일병", "이병", "훈련병"];

function getRankCategory(rankName) {
    if (OFFICERS.some(r => rankName.includes(r))) return 'officer';
    if (NCOS.some(r => rankName.includes(r))) return 'nco';
    return 'enlisted';
}

function parseMemberName(displayName) {
    const match = displayName.match(/^\[(.*?)\]\s*\((.*?)\)\s*(.*)$/);
    if (match) {
        return {
            rank: match[1].trim(),
            company: match[2].trim(),
            name: match[3].trim()
        };
    }
    return { rank: "미정", company: "기타", name: displayName };
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    console.log(`🤖 봇 서버 시작됨: ${client.user.tag}`);
    await refreshServerMembers();
});

async function refreshServerMembers() {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const members = await guild.members.fetch();
            
            const c5 = { officers: [], ncos: [], enlisted: [], total: 0, goal: "📌 실시간 연동 중" };
            const c6 = { officers: [], ncos: [], enlisted: [], total: 0, goal: "📌 실시간 연동 중" };

            members.forEach(member => {
                if (member.user.bot) return;

                const nameInfo = parseMemberName(member.displayName);
                const category = getRankCategory(nameInfo.rank);
                const memberObj = { rank: nameInfo.rank, name: nameInfo.name, status: "복무 중" };

                if (nameInfo.company.includes("5C")) {
                    if (category === 'officer') c5.officers.push(memberObj);
                    else if (category === 'nco') c5.ncos.push(memberObj);
                    else c5.enlisted.push(memberObj);
                    c5.total++;
                } else if (nameInfo.company.includes("6C")) {
                    if (category === 'officer') c6.officers.push(memberObj);
                    else if (category === 'nco') c6.ncos.push(memberObj);
                    else c6.enlisted.push(memberObj);
                    c6.total++;
                }
            });

            botData.company5 = c5;
            botData.company6 = c6;
        } catch (err) {
            console.error("멤버 데이터 동기화 오류:", err);
        }
    });
}

client.on('guildMemberRemove', (member) => {
    const nameInfo = parseMemberName(member.displayName);
    console.log(`⚠️ 무단이탈(퇴장) 발생: ${member.displayName}`);

    if (nameInfo.company.includes("5C")) {
        botData.summary.c5.deserter++;
    } else if (nameInfo.company.includes("6C")) {
        botData.summary.c6.deserter++;
    }
    refreshServerMembers();
});

client.on('messageCreate', (message) => {
    if (message.channelId !== REPORT_CHANNEL_ID || message.author.bot) return;

    const content = message.content;
    const targetMatch = content.match(/대상자\s*:\s*(.+)/);
    const typeMatch = content.match(/종류\s*:\s*(.+)/);

    if (targetMatch && typeMatch) {
        const targetName = targetMatch[1].trim();
        const type = typeMatch[1].trim();

        let is5c = botData.company5.enlisted.some(m => m.name === targetName) || 
                   botData.company5.officers.some(m => m.name === targetName) || 
                   botData.company5.ncos.some(m => m.name === targetName);

        const companyKey = is5c ? 'c5' : 'c6';

        if (type.includes("무탈")) {
            botData.summary[companyKey].deserter++;
        } else if (type.includes("전역")) {
            botData.summary[companyKey].retired++;
        } else if (type.includes("전출") && type.includes("3RD ID ->")) {
            botData.summary[companyKey].out++;
        } else if (type.includes("전출") && type.includes("-> 3RD ID")) {
            botData.summary[companyKey].in++;
        }

        refreshServerMembers();
    }
});

setInterval(refreshServerMembers, 5000);

app.use(express.static(__dirname));

app.get('/api/data', (req, res) => {
    res.json(botData);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌐 웹 서버 실행 중: http://localhost:${PORT}`);
});

client.login(BOT_TOKEN);