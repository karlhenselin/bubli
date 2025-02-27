import { useEffect, useState, useCallback } from "react";
import { Passage } from "./Passage";
import { Clue, clue, guessesNotInTarget, CluedLetter } from "./clue";
import { Keyboard } from "./Keyboard";
import { Language } from "./books";
import { Chart, getCanvas } from "./chart";
import i18n from './i18n';
import {
  gameName
} from "./util";
//import { decode, encode } from "./base64";

enum GameState {
  Playing,
  Won,
  Lost,
}

interface GameProps {
  hidden: boolean;
  colorBlind: boolean;
  keyboardLayout: string;
  language: Language;
  target: Map<number, CluedLetter[]>;
  puzzleId: number;
  reference: string;
  translation: string;
  refresh: number;
}


function mergeClues(letterStates: Map<number, CluedLetter[]>, arg1: Map<number, CluedLetter[]>): Map<number, CluedLetter[]> {
  letterStates.forEach(function (value, key) {
    for (const i in value) {
      if (value[i].clue !== Clue.Correct
        && value[i].clue !== Clue.Punctuation
      ) {
        value[i].clue = arg1.get(key)![i].clue;
      }
    }
  });

  return letterStates;
}

function Game(props: GameProps) {
  const [gameState, setGameState] = useState<GameState>(GameState.Playing);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [target, setTarget] = useState<Map<number, CluedLetter[]>>(() => { return new Map(props.target) });
  const [reference, setReference] = useState<string>(() => { return props.reference });
  const [translation, setTranslation] = useState<string>(() => { return props.translation });
  const [letterInfo, setLetterInfo] = useState<Map<string, Clue>>(() => new Map<string, Clue>());
  const [hint, setHint] = useState<string>(i18n.t('Make your first guess!'));
  const [restart, setRestart] = useState<number>(1);
  const [stats, setStats] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    setHint(i18n.t('Make your first guess!'));
    setGuesses([]);
    setCurrentGuess("");
    setLetterInfo(new Map<string, Clue>());
    setGameState(GameState.Playing);
    props.target.forEach((cluedLetters: CluedLetter[], word: number) => {
      cluedLetters.filter((x) => x.clue !== Clue.Punctuation).forEach((x) => x.clue = undefined);
    });
    setTarget(new Map(props.target));
    setReference(props.reference);
    setTranslation(props.translation);
    setStats({});
  }, [props.refresh, props.reference, props.target, props.translation, restart]);

  async function shareWon(copiedHint: string, text?: string) {
    const canvas = getCanvas();

    canvas.toBlob(async function (blob) {
      if (
        /android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) &&
        !/firefox/i.test(navigator.userAgent)
      ) {
        try {
          const filesArray = [
            new File(
              [blob!],
              'bibliResult.png',
              {
                type: "image/png",
                lastModified: new Date().getTime()
              }
            )];
          const shareData = {
            files: filesArray,
            text: wonMessage(),
            url: window.location.href
          };
          await navigator.share(shareData);
          return;
        } catch (e) {
          console.warn("navigator.share failed:", e);
        }
      }
      try {
        const item = new ClipboardItem({ "image/png": blob! });
        await navigator.clipboard.write([item]);
        setHint(copiedHint);
      } catch (e) {
        return "Copying image to clipboard failed: " + e;
      }
    });
  }

  async function share(copiedHint: string, text?: string) {
    const url = window.location.href
    if (
      /android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) &&
      !/firefox/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({ text: url });
        return;
      } catch (e) {
        console.warn("navigator.share failed:", e);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setHint(copiedHint);
      return;
    } catch (e) {
      console.warn("navigator.clipboard.writeText failed:", e);
    }
    setHint(url);
  }

  const onKey = useCallback((key: string) => {

    function getStatsData(score: number) {
      const url = "https://bibli.petraguardsoftware.com/stats.php?score=" + score + "&puzzleId=" + props.puzzleId
      const controller = new AbortController()

      // 5 second timeout:
      setTimeout(() => controller.abort(), 3000)
      fetch(url, {
        method: 'post',
        signal: controller.signal
      }).then(response => response.json())
        .then(data => {
          setStats(data);
        })
        .catch(err => {
          console.error(err);
          setFakeStats();
        });
    }

    function setFakeStats() {
      const diff = Array.from(target.values()).flat().length
      let data: { [key: string]: number };
      if (diff >= 90) {
        data = {
          "100+": 50,
          "80-99": 46,
          "60-79": 32,
          "40-59": 10,
          "20-39": 0,
          "<20": 0
        }
      } else if (diff >= 80) {
        data = {
          "100+": 40,
          "80-99": 56,
          "60-79": 42,
          "40-59": 15,
          "20-39": 0,
          "<20": 0
        }
      } else if (diff >= 70) {
        data = {
          "100+": 33,
          "80-99": 64,
          "60-79": 42,
          "40-59": 25,
          "20-39": 2,
          "<20": 0
        }
      } else if (diff >= 60) {
        data = {
          "100+": 10,
          "80-99": 38,
          "60-79": 50,
          "40-59": 55,
          "20-39": 4,
          "<20": 0
        }
      } else if (diff >= 50) {
        data = {
          "100+": 5,
          "80-99": 25,
          "60-79": 42,
          "40-59": 43,
          "20-39": 7,
          "<20": 0
        }
      } else if (diff >= 40) {
        data = {
          "100+": 2,
          "80-99": 20,
          "60-79": 27,
          "40-59": 38,
          "20-39": 12,
          "<20": 0
        }
      } else if (diff >= 30) {
        data = {
          "100+": 1,
          "80-99": 12,
          "60-79": 19,
          "40-59": 36,
          "20-39": 39,
          "<20": 2
        }
      } else if (diff >= 20) {
        data = {
          "100+": 2,
          "80-99": 13,
          "60-79": 19,
          "40-59": 33,
          "20-39": 47,
          "<20": 4
        }
      } else {
        data = {
          "100+": 2,
          "80-99": 4,
          "60-79": 7,
          "40-59": 29,
          "20-39": 39,
          "<20": 30
        }
      }
      if (guesses.length > 100) {
        data["100+"] += 1;
      } else if (guesses.length > 79) {
        data["80-99"] += 1;
      } else if (guesses.length > 59) {
        data["60-79"] += 1;
      } else if (guesses.length > 39) {
        data["40-59"] += 1;
      } else if (guesses.length > 19) {
        data["20-39"] += 1;
      } else {
        data["<20"] += 1;
      }

      setStats(data);
    }

    if (gameState === GameState.Won) {
      if (key === 'Escape') {
        setRestart(restart + 1);
      }
    } else if (/^[a-z]$/i.test(key)) {
      setCurrentGuess(key.toLowerCase());
      setHint("");
      setGuesses((guesses) => guesses.concat([key.toLowerCase()]));
      const t = mergeClues(new Map(target), clue(guesses.concat([key.toLowerCase()]).join(''), target))
      setTarget((nt) => t);
      let newLetters = new Map(letterInfo);
      for (const cl of guessesNotInTarget(key.toLowerCase(), target)) {
        if (cl.clue !== undefined) {
          newLetters.set(cl.letter.toLowerCase(), cl.clue);
        }
      }
      if (newLetters.size !== 0) {
        setLetterInfo(new Map([...letterInfo, ...newLetters]));
      }
      if (allDone(t)) {
        setHint("");
        setGameState(GameState.Won);
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || reference === "Custom Game") {
          setFakeStats();
        } else {
          getStatsData(guesses.length);
        }
      }
    }

  }, [letterInfo, guesses, target, restart, gameState, props.puzzleId, reference]);



  function wonMessage(): string {
    if (reference !== "Custom Game") {
      return reference + " (" + translation.substring(0, translation.indexOf("-")) + ") " + i18n.t("in") + " " + (guesses.length) + " " + i18n.t("guesses") + "."
    }
    return i18n.t(reference) + " " + translation + " " + i18n.t("in") + " " + (guesses.length) + " " + i18n.t("guesses") + "."

  }

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      onKey(e.key);
    }
    if (e.key === "Backspace") {
      e.preventDefault();
    }
  }, [onKey]);

  useEffect(() => {

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentGuess, gameState, onKeyDown, guesses]);



  return (
    <div className="Game" style={{ display: props.hidden ? "none" : "block" }}>
      <div id="chartHolder" style={{ display: gameState === GameState.Won ? "block" : "none" }}><div id="chartHolderInner">
        <button id="x" onClick={() => setRestart(restart + 1)}>X</button>
        {<Chart
          color={"#67b6c7"}
          data={stats}
          your={guesses.length}
          padding={10}
          gridColor={"#a55ca5"}
          gridScale={5}
          won={gameState === GameState.Won}
          message={wonMessage()}
        />}
        <div className="wonHint">
          {hint || `\u00a0`}
        </div>
        {gameState !== GameState.Playing && (
          <div className="buttons">
            <button
              onClick={() => {
                shareWon(
                  "Result copied to clipboard!",
                  `${gameName} ${guesses.length}\n`
                );
              }}
            >
              Share results
            </button>
            <button
              onClick={() => {
                setRestart(prev => prev + 1);
              }}
            >
              Try Again
            </button>{" "}
          </div>
        )}
      </div></div>
      <div
        className="Game-rows"
        tabIndex={0}
        aria-label="Passage"
      >
        <Passage
          key={0}
          cluedLetters={target}
        />
      </div>
      <p
        role="alert"
        style={{
          userSelect: /https?:/.test(hint) ? "text" : "none",
          whiteSpace: "pre-wrap",
        }}
      >
        {hint || `\u00a0`}
      </p>
      <Keyboard
        layout={props.keyboardLayout}
        letterInfo={letterInfo}
        onKey={onKey}
      />
      <p>
        <button
          onClick={() => {
            share("Link copied to clipboard!");
          }}
        >
          {i18n.t("Share a link to this game")}
        </button>{" "}
      </p>
    </div>
  );
}

export default Game;



function allDone(target: Map<number, CluedLetter[]>): boolean {
  return Array.from(target.values()).flat().filter((x) => x.clue !== Clue.Punctuation && x.clue !== Clue.Correct && x.clue !== Clue.Space).length === 0
}


