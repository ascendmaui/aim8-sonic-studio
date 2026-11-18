export interface Badge {
    title: string;
    icon: string;
    minPoints: number;
}

export const BADGES: Badge[] = [
    { title: "Aim8 Legend 👑", icon: "👑", minPoints: 1000 },
    { title: "Platinum Artist 🔥", icon: "🔥", minPoints: 500 },
    { title: "Hit Maker 💿", icon: "💿", minPoints: 200 },
    { title: "Rising Star 🌟", icon: "🌟", minPoints: 50 },
    { title: "Novice Producer 🎧", icon: "🎧", minPoints: 0 },
];

export const POINT_VALUES = {
    LIKE: 5,
    DOWNLOAD: 10,
    PLAY: 1,
};

export function getUserBadge(reputationPoints: number): Badge {
    // Assuming BADGES is sorted descending by minPoints as defined above
    for (const badge of BADGES) {
        if (reputationPoints >= Math.max(0, badge.minPoints)) {
            return badge;
        }
    }
    return BADGES[BADGES.length - 1]; // Fallback to lowest badge
}
