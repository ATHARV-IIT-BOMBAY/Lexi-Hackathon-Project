export async function analyzeTelemetry(telemetryData, therapyMode, targetItem, language = 'en') {
  if (!telemetryData || !telemetryData.strokes || telemetryData.strokes.length === 0) {
    return {
      score: 0,
      factors: [],
      kidFeedback: "Oh no! I couldn't see anything. Please try drawing it again!",
      clinicalAnalysis: ["No strokes detected."]
    };
  }

  const strokes = telemetryData.strokes;
  const accuracyRatio = telemetryData.accuracyRatio !== undefined ? telemetryData.accuracyRatio : 1;
  const coverageRatio = telemetryData.coverageRatio !== undefined ? telemetryData.coverageRatio : 1;
  const expectedStrokeCount = telemetryData.expectedStrokeCount || 1;
  const expectedStartPoint = telemetryData.expectedStartPoint || null;
  const targetBoundingBox = telemetryData.targetBoundingBox || null;
  const targetDistance = telemetryData.targetDistance || 0;
  const flatPoints = strokes.flat();
  const pointsCount = flatPoints.length;

  if (pointsCount < 3) {
    return {
      score: 5,
      factors: [],
      kidFeedback: "That looks a little too short! Try drawing the whole shape.",
      clinicalAnalysis: ["Drawing was aborted or too brief to analyze."]
    };
  }

  // --- 1. SHAPE ACCURACY (Weight: 20%) ---
  let scoreAccuracy = accuracyRatio * 100;
  
  // --- 2. STROKE COVERAGE (Weight: 20%) ---
  let scoreCoverage = coverageRatio * 100;

  // Mathematically adjust accuracy and coverage for severe Motor Planning failures (The "Squiggle Cheat")
  // If a multi-stroke letter is drawn with missing strokes, it fundamentally destroys the geometric accuracy.
  if (expectedStrokeCount > 1 && strokes.length < expectedStrokeCount) {
     const strokeDeficit = expectedStrokeCount - strokes.length;
     // Massive penalty for every missing stroke
     scoreAccuracy = Math.max(0, scoreAccuracy - (strokeDeficit * 30));
     scoreCoverage = Math.max(0, scoreCoverage - (strokeDeficit * 20));
  }

  // --- 3. MOTOR PLANNING (Weight: 10%) ---
  let scoreMotorPlanning = 100;
  if (strokes.length !== expectedStrokeCount) {
    if (strokes.length < expectedStrokeCount) {
       scoreMotorPlanning = Math.max(0, 100 - ((expectedStrokeCount - strokes.length) * 35));
    } else {
       scoreMotorPlanning = Math.max(0, 100 - ((strokes.length - expectedStrokeCount) * 15)); // Less penalty for extra scribbles
    }
  }

  // --- 4. ORTHOGRAPHIC RECALL / LIFT TIME (Weight: 10%) ---
  let scoreRecall = 100;
  let totalLiftTime = 0;
  if (strokes.length > 1) {
    for (let i = 1; i < strokes.length; i++) {
      const prevEnd = strokes[i-1][strokes[i-1].length - 1].time;
      const currStart = strokes[i][0].time;
      if (currStart > prevEnd) {
        totalLiftTime += (currStart - prevEnd);
      }
    }
    const avgLiftTime = totalLiftTime / (strokes.length - 1);
    // Ideal lift time < 500ms. Above 3000ms is 0 score.
    if (avgLiftTime > 500) {
      scoreRecall = Math.max(0, 100 - ((avgLiftTime - 500) / 25));
    }
  }

  // --- 5. START POINT ACCURACY (Weight: 5%) ---
  let scoreStartPoint = 100;
  if (expectedStartPoint) {
    const firstPoint = strokes[0][0];
    const dx = firstPoint.x - expectedStartPoint.x;
    const dy = firstPoint.y - expectedStartPoint.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 100) {
      scoreStartPoint = Math.max(0, 100 - ((dist - 100) / 4));
    }
  }

  // --- Calculate point-to-point velocity and angles ---
  let velocityInversions = 0;
  let sharpAngleChanges = 0;
  let midStrokePauses = 0;
  let lastVelocity = 0;

  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const p1 = stroke[i - 1];
      const p2 = stroke[i];
      const dt = p2.time - p1.time;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      let velocity = 0;
      if (dt > 0) {
         velocity = dist / dt;
         if (dist < 1 && dt > 100) {
            midStrokePauses += dt;
         }
      }
      
      // Fluidity / Inversions
      if (i > 1 && (velocity - lastVelocity) < -0.5) velocityInversions++;
      lastVelocity = velocity;
      
      // Tremor / Angles
      if (i > 2) {
         const p0 = stroke[i-2];
         const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
         const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
         let angleDiff = Math.abs(angle1 - angle2);
         if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
         // Relaxed angle threshold slightly for mouse users, but captures severe jaggedness
         if (angleDiff > Math.PI / 3 && angleDiff < 2 * Math.PI / 3) {
            sharpAngleChanges++;
         }
      }
    }
  }

  // --- 6. FLUIDITY (Weight: 10%) ---
  let scoreFluidity = Math.max(0, 100 - (velocityInversions * 3));

  // --- 7. TREMOR (Weight: 10%) ---
  // Allow a baseline of 4 sharp angle changes for natural letter corners (like B, M, W)
  let scoreTremor = Math.max(0, 100 - (Math.max(0, sharpAngleChanges - 4) * 8));

  // --- 8. COGNITIVE LOAD (Weight: 10%) ---
  let scoreCognitiveLoad = Math.max(0, 100 - (midStrokePauses / 40));

  // Calculate Bounds & Additional Metrics
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalDistance = 0;
  let totalTime = 0;
  let strokeVerticalDirection = "Top-to-Bottom";

  for (const stroke of strokes) {
    if (stroke.length > 2) {
      if (stroke[stroke.length - 1].y < stroke[0].y) strokeVerticalDirection = "Bottom-to-Top";
    }
    for (let i = 1; i < stroke.length; i++) {
       const dx = stroke[i].x - stroke[i-1].x;
       const dy = stroke[i].y - stroke[i-1].y;
       totalDistance += Math.sqrt(dx*dx + dy*dy);
       totalTime += stroke[i].time - stroke[i-1].time;
    }
  }

  // --- SCRIBBLE PENALTY (Path Efficiency) ---
  // Calculates how much the child drew "outside" or "on top" of the shape unnecessarily.
  let pathEfficiency = 1;
  if (targetDistance > 0 && totalDistance > 0) {
     pathEfficiency = targetDistance / totalDistance;
  }
  
  // Harsher penalty: If they drew >20% more OR >20% less than expected
  if (pathEfficiency < 0.8 || pathEfficiency > 1.25) {
     const deviation = Math.max(0, Math.abs(1 - pathEfficiency) - 0.2);
     const scribblePenalty = Math.max(0.1, 1 - (deviation * 1.5));
     scoreAccuracy = scoreAccuracy * scribblePenalty;
     scoreCoverage = scoreCoverage * scribblePenalty;
  }

  flatPoints.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  const width = maxX - minX;
  const height = maxY - minY;
  const aspect = height === 0 ? 1 : width / height;

  // --- 9. PROPORTIONALITY (Weight: 5%) ---
  let scoreProportionality = 100;
  let scoreSize = 100;

  if (targetBoundingBox && width > 10 && height > 10) {
    const targetWidth = targetBoundingBox.maxX - targetBoundingBox.minX;
    const targetHeight = targetBoundingBox.maxY - targetBoundingBox.minY;
    const targetAspect = targetHeight === 0 ? 1 : targetWidth / targetHeight;
    
    const aspectDiff = Math.abs(aspect - targetAspect) / targetAspect;
    scoreProportionality = Math.max(0, 100 - (aspectDiff * 100));

    // --- 10. SIZE CONTROL (Weight: 5%) ---
    const diag = Math.sqrt(width*width + height*height);
    const targetDiag = Math.sqrt(targetWidth*targetWidth + targetHeight*targetHeight);
    const sizeDiff = Math.abs(diag - targetDiag) / targetDiag;
    scoreSize = Math.max(0, 100 - (sizeDiff * 100));
  }

  // --- 11. DIRECTIONALITY (Weight: 2.5%) ---
  let scoreDirectionality = 100;
  // Only penalize bottom-to-top. Left-to-right is natural for the left leg of an 'A'.
  if (strokeVerticalDirection === "Bottom-to-Top") scoreDirectionality -= 50;
  scoreDirectionality = Math.max(0, scoreDirectionality);

  // --- 12. BIOMECHANICS (Weight: 2.5%) ---
  let scoreBiomechanics = 100;
  const avgSpeed = totalTime > 0 ? (totalDistance / totalTime) * 1000 : 0;
  if (avgSpeed < 50) scoreBiomechanics -= 40; // Relaxed for mouse users
  else if (avgSpeed > 3000) scoreBiomechanics -= 40;
  scoreBiomechanics = Math.max(0, scoreBiomechanics);

  // --- 13. STROKE ORDER & PROXIMITY (Weight: 10%) ---
  let scoreOrderAndProximity = 100;
  let orderPenalty = 0;
  const expectedStrokes = telemetryData.expectedStrokes || null;
  if (expectedStrokes && strokes.length === expectedStrokes.length) {
    for (let i = 0; i < strokes.length; i++) {
      const expectedStroke = expectedStrokes[i];
      const actualStroke = strokes[i];
      if (expectedStroke.points && expectedStroke.points.length > 0 && actualStroke.length > 0) {
        // Calculate center of mass for both
        const getCenter = (pts) => {
           const sumX = pts.reduce((sum, p) => sum + p.x, 0);
           const sumY = pts.reduce((sum, p) => sum + p.y, 0);
           return { x: sumX / pts.length, y: sumY / pts.length };
        };
        const centerExpected = getCenter(expectedStroke.points);
        const centerActual = getCenter(actualStroke);
        
        const dist = Math.sqrt(Math.pow(centerExpected.x - centerActual.x, 2) + Math.pow(centerExpected.y - centerActual.y, 2));
        
        // If the center of the drawn stroke is very far from the expected stroke (e.g. crossbar floating high above)
        if (dist > Math.max(40, targetDistance * 0.05)) {
           orderPenalty += 25;
        }
      }
    }
    scoreOrderAndProximity = Math.max(0, 100 - orderPenalty);
  } else if (strokes.length !== expectedStrokeCount) {
    // If they didn't even draw the right number of strokes, Order/Proximity is inherently flawed
    scoreOrderAndProximity -= 20;
  }
  scoreOrderAndProximity = Math.max(0, scoreOrderAndProximity);

  // === CALCULATE WEIGHTED MEAN ===
  const weights = {
    accuracy: 0.20, // Increased to 20%
    coverage: 0.20, // Increased to 20%
    motorPlanning: 0.10,
    recall: 0.05, // Dropped 5%
    startPoint: 0.05,
    fluidity: 0.05, // Dropped 5%
    tremor: 0.05, // Dropped 5%
    cognitiveLoad: 0.10,
    proportionality: 0.05,
    size: 0.05,
    directionality: 0.025,
    biomechanics: 0.025,
    orderAndProximity: 0.05 // Dropped 5%
  };

  let finalScore = Math.round(
    scoreAccuracy * weights.accuracy +
    scoreCoverage * weights.coverage +
    scoreMotorPlanning * weights.motorPlanning +
    scoreRecall * weights.recall +
    scoreStartPoint * weights.startPoint +
    scoreFluidity * weights.fluidity +
    scoreTremor * weights.tremor +
    scoreCognitiveLoad * weights.cognitiveLoad +
    scoreProportionality * weights.proportionality +
    scoreSize * weights.size +
    scoreDirectionality * weights.directionality +
    scoreBiomechanics * weights.biomechanics +
    scoreOrderAndProximity * weights.orderAndProximity
  );

  // --- HARD SCORE CAP FOR POOR SHAPE EXECUTION ---
  if (scoreCoverage < 70 && finalScore > 65) {
     finalScore = 65; // Hard cap
  }
  if (scoreCoverage < 20 && finalScore > 15) {
     finalScore = 15; // Basically erased / dotted
  }

  // === CLINICAL ANALYSIS ===
  const clinicalAnalysis = [];
  
  clinicalAnalysis.push(`Overall Score: ${finalScore}/100 (Dyslexia-Informed Weighted Mean)`);
  clinicalAnalysis.push(`Shape Accuracy (20% Weight): ${Math.round(scoreAccuracy)}/100`);
  clinicalAnalysis.push(`Stroke Coverage (20% Weight): ${Math.round(scoreCoverage)}/100`);
  clinicalAnalysis.push(`Motor Planning (10% Weight): ${Math.round(scoreMotorPlanning)}/100 (Expected ${expectedStrokeCount} strokes, drew ${strokes.length})`);
  clinicalAnalysis.push(`Orthographic Recall (5% Weight): ${Math.round(scoreRecall)}/100 (Avg Lift Time: ${Math.round(totalLiftTime / (strokes.length > 1 ? strokes.length-1 : 1))}ms)`);
  clinicalAnalysis.push(`Start Point Accuracy (5% Weight): ${Math.round(scoreStartPoint)}/100`);
  clinicalAnalysis.push(`Fluidity (5% Weight): ${Math.round(scoreFluidity)}/100 (${velocityInversions} velocity inversions)`);
  clinicalAnalysis.push(`Tremor (5% Weight): ${Math.round(scoreTremor)}/100 (${sharpAngleChanges} sharp angle changes)`);
  clinicalAnalysis.push(`Cognitive Load (10% Weight): ${Math.round(scoreCognitiveLoad)}/100 (${Math.round(midStrokePauses)}ms paused mid-stroke)`);
  clinicalAnalysis.push(`Proportionality (5% Weight): ${Math.round(scoreProportionality)}/100`);
  clinicalAnalysis.push(`Size Control (5% Weight): ${Math.round(scoreSize)}/100`);
  clinicalAnalysis.push(`Directionality (2.5% Weight): ${Math.round(scoreDirectionality)}/100 (${strokeVerticalDirection})`);
  clinicalAnalysis.push(`Biomechanics (2.5% Weight): ${Math.round(scoreBiomechanics)}/100 (Avg Speed: ${Math.round(avgSpeed)}px/s)`);
  clinicalAnalysis.push(`Order & Proximity (5% Weight): ${Math.round(scoreOrderAndProximity)}/100 (-${orderPenalty} penalty)`);

  // Formulate Contextual Kid Feedback
  let kidFeedback = "Great job! Keep practicing!";
  const itemName = targetItem ? targetItem : "that";

  if (finalScore < 40) {
    if (scoreCoverage < 50) kidFeedback = `Oops! You didn't finish drawing ${itemName}. Try to complete it!`;
    else if (scoreMotorPlanning < 50) kidFeedback = `Nice try on ${itemName}, but make sure to lift your pen and draw all the parts separately.`;
    else kidFeedback = `Oops! That doesn't look quite like ${itemName}. Try to follow the guide carefully!`;
  } else if (finalScore >= 90) {
    const praises = [
      `Wow! You drew ${itemName} so smoothly and perfectly!`,
      `That is the best ${itemName} I've ever seen! You're a superstar!`,
      `Perfect execution! Your ${itemName} is flawless.`,
      `Incredible! You followed the lines for ${itemName} like a true artist!`
    ];
    kidFeedback = praises[Math.floor(Math.random() * praises.length)];
  } else if (finalScore >= 70) {
    const praises = [
      `Good job! Your ${itemName} is looking really good.`,
      `Well done! You're getting better at drawing ${itemName} every time!`,
      `Nice work! That ${itemName} is very clear.`,
      `You did a great job following the path for ${itemName}!`
    ];
    kidFeedback = praises[Math.floor(Math.random() * praises.length)];
  } else {
    kidFeedback = `You're getting the hang of ${itemName}! Keep practicing to make it perfect!`;
  }

  // Create UI detailed scores format
  const detailedScores = [
    { category: "Geometric Accuracy", score: Math.round(scoreAccuracy), description: "Percentage of strokes accurately matching the target path." },
    { category: "Stroke Coverage", score: Math.round(scoreCoverage), description: "Percentage of the target shape that was touched." },
    { category: "Motor Planning", score: Math.round(scoreMotorPlanning), description: "Ability to use the correct number of discrete strokes." },
    { category: "Orthographic Recall", score: Math.round(scoreRecall), description: "Speed of memory retrieval measured by pen-lift time." },
    { category: "Start Point", score: Math.round(scoreStartPoint), description: "Accuracy of the initial starting position." },
    { category: "Fluidity", score: Math.round(scoreFluidity), description: "Smoothness of motion without sudden velocity inversions." },
    { category: "Tremor", score: Math.round(scoreTremor), description: "Lack of high-frequency shaky or jagged movements." },
    { category: "Cognitive Load", score: Math.round(scoreCognitiveLoad), description: "Lack of mid-stroke pauses which indicate high cognitive demand." },
    { category: "Proportionality", score: Math.round(scoreProportionality), description: "Correct height-to-width aspect ratio." },
    { category: "Size Control", score: Math.round(scoreSize), description: "Drawing scaled appropriately without macro/micrographia." },
    { category: "Directionality", score: Math.round(scoreDirectionality), description: "Flags abnormal stroke directions (bottom-up or right-to-left)." },
    { category: "Biomechanics", score: Math.round(scoreBiomechanics), description: "Monitors overall stroke velocity for overly slow or erratic movements." },
    { category: "Stroke Order & Proximity", score: Math.round(scoreOrderAndProximity), description: "Checks if parts were drawn in the correct order and correct location." }
  ];

  // Formulate Kid Tips
  const kidTips = [];
  if (scoreCoverage < 80) kidTips.push({ icon: "🎨", text: "Make sure to draw the whole shape and don't miss any parts!" });
  if (scoreAccuracy < 80) kidTips.push({ icon: "📏", text: "Try your best to stay exactly on the gray lines!" });
  if (scoreMotorPlanning < 80) kidTips.push({ icon: "✋", text: "Don't forget to lift your pen between the different lines!" });
  if (scoreTremor < 80) kidTips.push({ icon: "✨", text: "Try to keep your hand steady and draw smooth lines!" });
  if (scoreOrderAndProximity < 80) kidTips.push({ icon: "🔢", text: "Try to draw the parts in the correct order!" });
  if (scoreFluidity < 80) kidTips.push({ icon: "🚀", text: "Try to draw in one smooth motion without stopping!" });
  
  if (kidTips.length === 0) kidTips.push({ icon: "🌟", text: "You did perfectly! Just keep practicing!" });

  const topKidTips = kidTips.slice(0, 3);

  // 4. Contextual Next Mission Prompts
  let nextMission = "Let's keep practicing!";
  if (therapyMode === 'letters') {
    nextMission = `Can you try writing another letter now?`;
  } else if (therapyMode === 'words') {
    nextMission = `Great spelling! Let's write another word!`;
  } else if (therapyMode === 'sentences') {
    nextMission = `You're a great writer! Try the next sentence!`;
  } else if (therapyMode === 'numbers') {
    nextMission = `Let's count! Can you draw the next number?`;
  } else if (therapyMode === 'tracing' || therapyMode === 'games') {
    const missions = [
      "Now try drawing a bouncy ball!",
      "Can you draw a tall tree?",
      "Try drawing a big smiley face!",
      "Let's trace a zigzag line!"
    ];
    nextMission = missions[Math.floor(Math.random() * missions.length)];
  }

  // Simulate AI Thinking delay for the Dynamic Island
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    score: finalScore,
    factors: detailedScores,
    detailedScores: detailedScores, // Ensures UI Button works correctly
    kidFeedback,
    kidTips: topKidTips,
    clinicalAnalysis,
    nextMission
  };
}
