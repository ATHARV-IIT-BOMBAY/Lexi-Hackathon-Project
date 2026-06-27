/**
 * Helper to generate smooth curve points
 * @param {number} cx Center X
 * @param {number} cy Center Y
 * @param {number} rx Radius X
 * @param {number} ry Radius Y
 * @param {number} startAngle Degrees
 * @param {number} endAngle Degrees
 * @param {number} numPoints How many points to generate
 */
function arc(cx, cy, rx, ry, startAngle, endAngle, numPoints = 60) {
  const points = [];
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startRad + t * (endRad - startRad);
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return points;
}

export const VECTOR_FONT = {
  'A': [ [[50,0], [10,100]], [[50,0], [90,100]], [[25,60], [75,60]] ],
  'B': [ 
    [[10,0], [10,100]], 
    [ [10,0], [60,0], ...arc(60, 25, 30, 25, -90, 90), [10,50] ], 
    [ [10,50], [60,50], ...arc(60, 75, 40, 25, -90, 90), [10,100] ] 
  ],
  'C': [ [...arc(50, 50, 40, 50, 40, 320).reverse()] ],
  'D': [ [[10,0], [10,100]], [ [10,0], [50,0], ...arc(50, 50, 40, 50, -90, 90), [10,100] ] ],
  'E': [ [[90,0], [10,0], [10,100], [90,100]], [[10,50], [70,50]] ],
  'F': [ [[90,0], [10,0], [10,100]], [[10,50], [70,50]] ],
  'G': [ [...arc(50, 50, 40, 50, 0, 315).reverse(), [50, 50]] ],
  'H': [ [[10,0], [10,100]], [[90,0], [90,100]], [[10,50], [90,50]] ],
  'I': [ [[50,0], [50,100]] ],
  'J': [ [[90,0], [90,70], ...arc(50, 70, 40, 30, 0, 180)] ],
  'K': [ [[10,0], [10,100]], [[10,50], [90,0]], [[40,30], [90,100]] ],
  'L': [ [[10,0], [10,100], [90,100]] ],
  'M': [ [[0,105], [0,0], [50,105], [100,0], [100,105]] ],
  'N': [ [[10,100], [10,0], [90,100], [90,0]] ],
  'O': [ [...arc(48.75, 50, 29.25, 48.5, -90, 270)] ],
  'P': [ [[10,100], [10,0]], [ [10,0], [60,0], ...arc(60, 25, 30, 25, -90, 90), [10,50] ] ],
  'Q': [ [...arc(48.75, 50, 29.25, 48.5, -90, 270)], [[57,60], [87,90]] ],
  'R': [ [[10,100], [10,0]], [ [10,0], [60,0], ...arc(60, 25, 30, 25, -90, 90), [10,50] ], [[50,50], [90,100]] ],
  'S': [ [ ...arc(50, 25, 40, 25, 90, 315).reverse(), ...arc(50, 75, 40, 25, -90, 180) ] ],
  'T': [ [[10,0], [90,0]], [[50,0], [50,100]] ],
  'U': [ [[10,0], [10,70], ...arc(50, 70, 40, 30, 0, 180).reverse(), [90,0]] ],
  'V': [ [[10,0], [50,100], [90,0]] ],
  'W': [ [[0,-25], [25,100], [50,0], [75,100], [100,-25]] ],
  'X': [ [[10,0], [90,100]], [[90,0], [10,100]] ],
  'Y': [ [[10,0], [50,50], [90,0]], [[50,50], [50,100]] ],
  'Z': [ [[10,0], [90,0], [10,100], [90,100]] ],
  'a': [
    [ ...arc(55, 45, 25, 15, 180, 360), [80, 100] ],
    [
      ...arc(55, 75, 25, 25, 0, 270).reverse(),
      [80, 50],
      [55, 50]
    ]
  ],
  'b': [ [[20,0], [20,100]], [...arc(50, 70, 30, 30, -90, 270)] ],
  'c': [ [...arc(50, 70, 30, 30, 45, 315).reverse()] ],
  'd': [ [[80,0], [80,100]], [...arc(50, 70, 30, 30, -90, 270)] ],
  'e': [ [[20,70], ...arc(50, 70, 30, 30, 45, 360).reverse()] ],
  'f': [ [[50,100], [50,30], ...arc(80, 30, 30, 30, 180, 270)], [[20,50], [80,50]] ],
  'g': [ [[80,40], [80,120], ...arc(50, 120, 30, 30, 0, 180)], [...arc(50, 70, 30, 30, -90, 270)] ],
  'h': [ [[20,0], [20,100]], [[20,60], ...arc(50, 60, 30, 30, 180, 360), [80,100]] ],
  'i': [ [[50,40], [50,100]], [[50,10], [50,15]] ],
  'j': [ [[50,40], [50,120], ...arc(30, 120, 20, 20, 0, 180)], [[50,10], [50,15]] ],
  'k': [ [[20,0], [20,100]], [[80,40], [20,70]], [[50,55], [80,100]] ],
  'l': [ [[50,0], [50,100]] ],
  'm': [ [[10,40], [10,100]], [[10,60], ...arc(30, 60, 20, 20, 180, 360), [50,100]], [[50,60], ...arc(70, 60, 20, 20, 180, 360), [90,100]] ],
  'n': [ [[20,40], [20,100]], [[20,60], ...arc(50, 60, 30, 30, 180, 360), [80,100]] ],
  'o': [ [...arc(50, 70, 30, 30, -90, 270)] ],
  'p': [ [[20,40], [20,140]], [...arc(50, 70, 30, 30, -90, 270)] ],
  'q': [ [[80,40], [80,140]], [...arc(50, 70, 30, 30, -90, 270)] ],
  'r': [ [[30,40], [30,100]], [[30,60], ...arc(50, 60, 20, 20, 180, 270)] ],
  's': [ [ ...arc(50, 55, 30, 15, 90, 315).reverse(), ...arc(50, 85, 30, 15, -90, 180) ] ],
  't': [ [[50,20], [50,80], ...arc(70, 80, 20, 20, 90, 180).reverse()], [[20,40], [80,40]] ],
  'u': [ [[20,40], [20,70], ...arc(50, 70, 30, 30, 0, 180).reverse()], [[80,40], [80,100]] ],
  'v': [ [[20,40], [50,100], [80,40]] ],
  'w': [ [[10,40], [30,100], [50,60], [70,100], [90,40]] ],
  'x': [ [[20,40], [80,100]], [[80,40], [20,100]] ],
  'y': [ [[20,40], [50,100]], [[80,40], [30,140]] ],
  'z': [ [[20,40], [80,40], [20,100], [80,100]] ],
  '0': [ [...arc(50, 50, 30, 50, -90, 270)] ],
  '1': [ [[30,20], [50,0], [50,100]] ],
  '2': [ [...arc(50, 25, 30, 25, 180, 360), [20,100], [80,100]] ],
  '3': [ [...arc(50, 25, 30, 25, -180, 90), ...arc(50, 75, 30, 25, -90, 180)] ],
  '4': [ [[70,0], [20,60], [90,60]], [[70,0], [70,100]] ],
  '5': [ [[27,0], [27,46], ...arc(50, 65, 30, 30, -140, 150)], [[27,0], [80,0]] ],
  '6': [ [...arc(60, 70, 40, 60, -65, -180), ...arc(50, 70, 30, 30, -180, -540)] ],
  '7': [ [[20,0], [80,0], [40,100]] ],
  '8': [ [...arc(50, 25, 30, 25, 90, 450), ...arc(50, 75, 30, 25, -90, 270)] ],
  '9': [ [...arc(50, 35, 30, 30, 0, -360), ...arc(50, 65, 30, 30, 0, 160)] ],
  '+': [ [[20,50], [80,50]], [[50,20], [50,80]] ],
  '-': [ [[20,50], [80,50]] ],
  '=': [ [[20,35], [80,35]], [[20,65], [80,65]] ],
  ' ': [],
  'Square': [ [[20.8, 12.5], [79.2, 12.5], ...arc(79.2, 20.8, 8.3, 8.3, -90, 0), [87.5, 79.2], ...arc(79.2, 79.2, 8.3, 8.3, 0, 90), [20.8, 87.5], ...arc(20.8, 79.2, 8.3, 8.3, 90, 180), [12.5, 20.8], ...arc(20.8, 20.8, 8.3, 8.3, 180, 270)] ],
  'Triangle': [ [[50,16.7], [83.3,87.5], [16.7,87.5], [50,16.7]] ],
  'Circle': [ [...arc(50, 50, 41.7, 41.7, -90, 270)] ],
  'Star': [ [[50,10], [60,35], [90,35], [65,55], [75,90], [50,70], [25,90], [35,55], [10,35], [40,35], [50,10]] ],
  'Rectangle': [ [[16.6, 25], [83.4, 25], ...arc(83.4, 33.3, 8.3, 8.3, -90, 0), [91.7, 66.7], ...arc(83.4, 66.7, 8.3, 8.3, 0, 90), [16.6, 75], ...arc(16.6, 66.7, 8.3, 8.3, 90, 180), [8.3, 33.3], ...arc(16.6, 33.3, 8.3, 8.3, 180, 270)] ],
  'Heart': [ [...arc(29.1, 33.3, 20.8, 20.8, 0, -180), [20.8, 58.3], [50, 87.5], [79.2, 58.3], ...arc(70.8, 33.3, 20.8, 20.8, 0, -180)] ],
  'Diamond': [ [[50,10], [90,50], [50,90], [10,50], [50,10]] ],
  'Oval': [ [...arc(50, 50, 41.7, 41.7, -90, 270)] ],
  'Hexagon': [ [[50,10], [85,30], [85,70], [50,90], [15,70], [15,30], [50,10]] ]
};

/**
 * Calculates a point along a line segment given a percentage (0.0 to 1.0)
 */
function interpolate(p1, p2, percent) {
  return [
    p1[0] + (p2[0] - p1[0]) * percent,
    p1[1] + (p2[1] - p1[1]) * percent
  ];
}

/**
 * Generates an array of evenly spaced points for a given text string.
 * @param {string} text 
 * @param {number} x - Starting X coordinate of the center of the text block
 * @param {number} y - Starting Y coordinate of the center of the text block
 * @param {number} scale - Size multiplier (e.g., 500 for a 500px tall box)
 * @returns {Array<{strokeIndex: number, points: Array<[number, number]>}>}
 */
export function generateTracingStrokes(text, centerX, centerY, fontScale) {
  const isShape = ['Square', 'Triangle', 'Circle', 'Star', 'Rectangle', 'Heart', 'Diamond', 'Oval', 'Hexagon'].includes(text);
  
  let words = isShape ? [text] : String(text).split(' ');
  
  const heightScale = isShape ? fontScale : fontScale * 0.70;
  const widthScale = isShape ? fontScale : fontScale * 0.45;
  const letterSpacing = widthScale * 0.15;
  const spaceWidth = widthScale + letterSpacing;

  const LETTER_WIDTH_MULTIPLIERS = {
    'W': 1.6, 'w': 1.6, 'M': 1.4, 'm': 1.4, 'O': 1.1, 'Q': 1.1, 'C': 1.1,
    'G': 1.1, 'D': 1.1, 'Oval': 1.5, 'i': 0.35, 'l': 0.35, 't': 0.5,
    'f': 0.5, 'j': 0.5, 'r': 0.6, 'I': 0.4
  };

  const getWordWidth = (wordArray) => {
    let w = 0;
    for (let i = 0; i < wordArray.length; i++) {
      const char = wordArray[i];
      const mult = LETTER_WIDTH_MULTIPLIERS[char] || 1.0;
      w += widthScale * mult;
      if (i < wordArray.length - 1) w += letterSpacing;
    }
    return w;
  };

  const maxWidth = 2500;
  let lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const ww = getWordWidth(isShape ? [word] : word.split(''));
    if (currentLine.length === 0) {
      currentLine.push(word);
      currentLineWidth = ww;
    } else {
      if (currentLineWidth + spaceWidth + ww > maxWidth) {
        lines.push({ words: currentLine, width: currentLineWidth });
        currentLine = [word];
        currentLineWidth = ww;
      } else {
        currentLine.push(word);
        currentLineWidth += spaceWidth + ww;
      }
    }
  }
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, width: currentLineWidth });
  }

  const lineHeight = fontScale * 1.5;
  const totalHeight = lines.length * lineHeight;
  let startY = centerY - (totalHeight / 2) + (lineHeight / 2) - (heightScale / 2);

  const strokes = [];
  let globalStrokeIndex = 0;

  for (const line of lines) {
    let currentX = centerX - (line.width / 2);

    for (let w = 0; w < line.words.length; w++) {
      const word = line.words[w];
      const letters = isShape ? [word] : word.split('');

      for (let c = 0; c < letters.length; c++) {
        const char = letters[c];
        const mult = LETTER_WIDTH_MULTIPLIERS[char] || 1.0;
        const currentWidthScale = widthScale * mult;

        const template = VECTOR_FONT[char] || VECTOR_FONT['?'];
        if (template) {
          for (const rawStroke of template) {
            const points = [];
            for (let i = 0; i < rawStroke.length - 1; i++) {
              const p1 = rawStroke[i];
              const p2 = rawStroke[i+1];
              
              const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
              const numPoints = Math.max(2, Math.floor(dist));
              
              for (let j = 0; j <= numPoints; j++) {
                const rawPoint = interpolate(p1, p2, j / numPoints);
                const finalX = currentX + (rawPoint[0] / 100) * currentWidthScale;
                const finalY = startY + (rawPoint[1] / 100) * heightScale;
                points.push([finalX, finalY]);
              }
            }
            strokes.push({ strokeIndex: globalStrokeIndex++, points: points });
          }
        }
        
        currentX += currentWidthScale;
        if (c < letters.length - 1) {
          currentX += letterSpacing;
        }
      }
      
      if (w < line.words.length - 1) {
        currentX += spaceWidth;
      }
    }
    
    startY += lineHeight;
  }

  return strokes;
}
