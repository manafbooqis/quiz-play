function getPlayerName(player) {
  return (
    player?.student_name ||
    player?.name ||
    player?.full_name ||
    "Unknown"
  );
}

function getPlayerKeys(player) {
  return [
    player?.id,
    player?.student_name,
    player?.name,
    player?.full_name,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function getResponseTime(response) {
  return new Date(response?.answered_at || response?.created_at || 0).getTime();
}

function normalizeKey(value) {
  return String(value ?? "").trim();
}

export function getTotalQuestions(sessionQuestionCount, responses = []) {
  const count = Number(sessionQuestionCount) || 0;
  if (count > 0) return count;

  const answeredQuestionIds = new Set();
  responses.forEach((response) => {
    const questionId = normalizeKey(response?.question_id);
    if (questionId) answeredQuestionIds.add(questionId);
  });
  return answeredQuestionIds.size;
}

export function getPointsPerQuestion(scoringConfig = {}, responses = []) {
  const configuredPoints = Number(
    scoringConfig?.points_per_question ??
      scoringConfig?.pointsPerQuestion ??
      scoringConfig?.points_per_question_value
  );
  if (configuredPoints > 0) return configuredPoints;

  const pointCounts = new Map();
  responses.forEach((response) => {
    if (response?.is_correct !== true) return;

    const points = Number(response?.points_awarded);
    if (points > 0) {
      pointCounts.set(points, (pointCounts.get(points) || 0) + 1);
    }
  });

  if (pointCounts.size === 0) return 0;

  return [...pointCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    })[0][0];
}

export function getMaxPossibleScore(totalQuestions = 0, pointsPerQuestion = 0) {
  return Math.round(Number(totalQuestions || 0) * Number(pointsPerQuestion || 0));
}

export function getScoreDistributionBuckets(scores = [], maxPossibleScore = 0, bucketCount = 5) {
  const safeMax = Math.max(Number(maxPossibleScore) || 0, ...scores, 1);
  const bucketSize = Math.ceil(safeMax / bucketCount) || 1;
  const ranges = Array.from({ length: bucketCount }, (_, index) => {
    const low = index * bucketSize;
    const high =
      index === bucketCount - 1
        ? Math.max(safeMax, (index + 1) * bucketSize - 1)
        : (index + 1) * bucketSize - 1;
    return [low, high];
  });

  const labels = ranges.map(([low, high]) => `${low}-${high}`);
  const counts = ranges.map(([low, high], index) =>
    scores.filter((score) =>
      index === ranges.length - 1
        ? score >= low && score <= high
        : score >= low && score <= high
    ).length
  );

  return { labels, counts, ranges };
}

export function calculateLeaderboard(
  players = [],
  responses = [],
  sessionQuestionCount = 0,
  scoringConfig = {}
) {
  const responseGroups = {};

  responses.forEach((response) => {
    const playerId = normalizeKey(response?.player_id);
    if (!playerId) return;

    if (!responseGroups[playerId]) {
      responseGroups[playerId] = {
        responses: [],
        completedAt: 0,
      };
    }

    responseGroups[playerId].responses.push(response);
    responseGroups[playerId].completedAt = Math.max(
      responseGroups[playerId].completedAt,
      getResponseTime(response)
    );
  });

  const totalQuestions = getTotalQuestions(sessionQuestionCount, responses);
  const pointsPerQuestion = getPointsPerQuestion(scoringConfig, responses);
  const maxPossibleScore = getMaxPossibleScore(totalQuestions, pointsPerQuestion);
  const playersByName = new Map();
  const knownPlayerKeys = new Set();

  players.forEach((player) => {
    const name = getPlayerName(player);
    if (!playersByName.has(name)) playersByName.set(name, player);
    getPlayerKeys(player).forEach((key) => knownPlayerKeys.add(key));
  });

  Object.keys(responseGroups).forEach((playerId) => {
    if (!knownPlayerKeys.has(playerId) && !playersByName.has(playerId)) {
      playersByName.set(playerId, { student_name: playerId });
    }
  });

  return Array.from(playersByName.values())
    .map((player) => {
      const name = getPlayerName(player);
      const matchedGroups = getPlayerKeys(player)
        .map((key) => responseGroups[key])
        .filter(Boolean);
      const playerResponses = matchedGroups.flatMap((group) => group.responses);
      const correctAnswers = playerResponses.filter(
        (response) => response.is_correct === true
      ).length;
      const completedAt = Math.max(
        ...matchedGroups.map((group) => group.completedAt),
        0
      );
      const joinedAt = new Date(player.joined_at || player.created_at || 0).getTime();
      const score = Math.round(correctAnswers * pointsPerQuestion);
      const accuracy =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0;

      return {
        id: player.id || player.student_name || name,
        name,
        correct: correctAnswers,
        correctAnswers,
        total: totalQuestions,
        totalQuestions,
        score,
        pointsPerQuestion,
        maxPossibleScore,
        accuracy,
        completedAt,
        joinedAt,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aCompletedAt = a.completedAt || Number.MAX_SAFE_INTEGER;
      const bCompletedAt = b.completedAt || Number.MAX_SAFE_INTEGER;
      if (aCompletedAt !== bCompletedAt) return aCompletedAt - bCompletedAt;
      if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
      return a.name.localeCompare(b.name);
    })
    .map((player, index) => ({ ...player, rank: index + 1 }));
}
