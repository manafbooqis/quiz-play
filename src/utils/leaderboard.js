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

export const DIFFICULTY_POINTS = {
  easy: 10,
  medium: 25,
  hard: 50,
};

export function getDifficultyPoints(difficulty) {
  const key = normalizeKey(difficulty).toLowerCase();
  return DIFFICULTY_POINTS[key] || 0;
}

function getQuestionId(question) {
  return normalizeKey(question?.id || question?.question_id || question?.qid);
}

function getQuestionDifficulty(question) {
  return (
    question?.difficulty ||
    question?.level ||
    question?.current_difficulty ||
    question?.difficulty_level
  );
}

function getQuestionPoints(question) {
  const explicitPoints = Number(
    question?.points_possible ??
      question?.points ??
      question?.point_value ??
      question?.points_awarded
  );
  if (explicitPoints > 0) return explicitPoints;
  return getDifficultyPoints(getQuestionDifficulty(question));
}

function getQuestionPointMap(scoringConfig = {}) {
  const questionsByDifficulty =
    scoringConfig?.questions_by_difficulty ||
    scoringConfig?.questionsByDifficulty ||
    {};
  const map = new Map();

  Object.entries(questionsByDifficulty).forEach(([difficulty, questions]) => {
    if (!Array.isArray(questions)) return;

    questions.forEach((question) => {
      const questionId = getQuestionId(question);
      if (!questionId) return;

      const points =
        getQuestionPoints(question) || getDifficultyPoints(difficulty);
      if (points > 0) map.set(questionId, points);
    });
  });

  const flatQuestions =
    scoringConfig?.questions ||
    scoringConfig?.question_bank ||
    scoringConfig?.questionBank ||
    [];

  if (Array.isArray(flatQuestions)) {
    flatQuestions.forEach((question) => {
      const questionId = getQuestionId(question);
      const points = getQuestionPoints(question);
      if (questionId && points > 0) map.set(questionId, points);
    });
  }

  return map;
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

function getResponsePossiblePoints(response, questionPointMap = new Map()) {
  const explicitPossible = Number(
    response?.points_possible ?? response?.point_value ?? response?.possible_points
  );
  if (explicitPossible > 0) return explicitPossible;

  const difficultyPoints = getDifficultyPoints(response?.difficulty);
  if (difficultyPoints > 0) return difficultyPoints;

  const questionPoints = questionPointMap.get(normalizeKey(response?.question_id));
  if (questionPoints > 0) return questionPoints;

  const awardedPoints = Number(response?.points_awarded);
  return awardedPoints > 0 ? awardedPoints : 0;
}

export function getMaxPossibleScore(
  totalQuestions = 0,
  scoringConfig = {},
  responses = []
) {
  const questionPointMap = getQuestionPointMap(scoringConfig);
  const playedQuestionIds = new Set(
    responses
      .map((response) => normalizeKey(response?.question_id))
      .filter(Boolean)
  );

  if (playedQuestionIds.size > 0 && playedQuestionIds.size <= Number(totalQuestions || 0)) {
    const knownQuestionTotal = [...playedQuestionIds].reduce(
      (sum, questionId) => sum + Number(questionPointMap.get(questionId) || 0),
      0
    );
    if (knownQuestionTotal > 0) return Math.round(knownQuestionTotal);
  }

  if (responses.length > 0) {
    const possibleByPlayer = new Map();
    let hasUnknownPlayerPossiblePoints = false;
    responses.forEach((response) => {
      const playerId = normalizeKey(response?.player_id);
      const questionId = normalizeKey(response?.question_id);
      if (!playerId || !questionId) return;

      if (!possibleByPlayer.has(playerId)) possibleByPlayer.set(playerId, new Map());
      const possiblePoints = getResponsePossiblePoints(response, questionPointMap);
      if (possiblePoints <= 0) hasUnknownPlayerPossiblePoints = true;
      possibleByPlayer.get(playerId).set(questionId, possiblePoints);
    });

    const playerPossibleScores = [...possibleByPlayer.values()].map((questionMap) =>
      [...questionMap.values()].reduce((sum, points) => sum + Number(points || 0), 0)
    );
    const maxPlayerPossibleScore = Math.max(...playerPossibleScores, 0);
    if (!hasUnknownPlayerPossiblePoints && maxPlayerPossibleScore > 0) {
      return Math.round(maxPlayerPossibleScore);
    }

    const possibleByRound = new Map();
    responses.forEach((response) => {
      const roundKey =
        normalizeKey(response?.round_number) ||
        normalizeKey(response?.question_id);
      if (!roundKey) return;

      const points = getResponsePossiblePoints(response, questionPointMap);
      if (points > 0) {
        possibleByRound.set(
          roundKey,
          Math.max(possibleByRound.get(roundKey) || 0, points)
        );
      }
    });

    const responseDerivedTotal = [...possibleByRound.values()].reduce(
      (sum, points) => sum + points,
      0
    );
    if (responseDerivedTotal > 0) return Math.round(responseDerivedTotal);
  }

  // When question difficulty data is unavailable, use the highest configured
  // difficulty value so the distribution chart never under-scales real scores.
  return Math.round(Number(totalQuestions || 0) * DIFFICULTY_POINTS.hard);
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
  const maxPossibleScore = getMaxPossibleScore(
    totalQuestions,
    scoringConfig,
    responses
  );
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
      const score = playerResponses
        .filter((response) => response.is_correct === true)
        .reduce(
          (sum, response) => sum + Number(response.points_awarded || 0),
          0
        );
      const completedAt = Math.max(
        ...matchedGroups.map((group) => group.completedAt),
        0
      );
      const joinedAt = new Date(player.joined_at || player.created_at || 0).getTime();
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
        score: Math.round(score),
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
