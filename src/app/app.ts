import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgClass, NgIf, NgForOf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chess, Move, Square } from 'chess.js';

type Piece = '' | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgClass, NgIf, NgForOf, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit, OnDestroy {
  chess = new Chess();
  moveInput = '';
  blindfold = false;
  moveError = '';
  selectedSquare: string | null = null;

  files = ['a','b','c','d','e','f','g','h'];
  ranks = [8,7,6,5,4,3,2,1];

  whiteName = 'White';
  blackName = 'Black';
  whiteTime = 5 * 60;
  blackTime = 5 * 60;
  activeColor: 'w' | 'b' = 'w';
  timerInterval: any = null;
  timeUp: '' | 'w' | 'b' = '';

  isListening = false;
  recognition: any = null;

  // Enhanced voice features
  voiceEnabled = false;
  lastSpokenText = '';
  synthesis: any = null;
  voiceRate = 0.8;
  voicePitch = 1;

  touchStartSquare: string | null = null;
  recognizedVoiceMove: string = '';

  moveAudio: HTMLAudioElement;
  captureAudio: HTMLAudioElement;
  soundReady = false;

  constructor() {
    this.moveAudio = new Audio('https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_move.wav');
    this.captureAudio = new Audio('https://upload.wikimedia.org/wikipedia/commons/8/88/Chess_capture.wav');
    this.moveAudio.load();
    this.captureAudio.load();
    
    // Initialize speech synthesis
    this.synthesis = window.speechSynthesis;
  }

  ensureSoundReady() {
    if (!this.soundReady) {
      this.moveAudio.load();
      this.captureAudio.load();
      this.moveAudio.volume = 0;
      this.captureAudio.volume = 0;
      this.moveAudio.play().then(() => this.moveAudio.pause()).catch(()=>{});
      this.captureAudio.play().then(() => this.captureAudio.pause()).catch(()=>{});
      this.moveAudio.volume = 1;
      this.captureAudio.volume = 1;
      this.soundReady = true;
    }
  }

  ngOnInit() {
    this.startTimer();
    this.speak('Welcome to Blindfold Chess. White to move. Click voice mode to enable announcements.');
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.recognition) this.recognition.abort();
    if (this.synthesis) this.synthesis.cancel();
  }

  // Voice functionality
  toggleVoiceMode() {
    this.voiceEnabled = !this.voiceEnabled;
    if (this.voiceEnabled) {
      this.speak('Voice mode enabled. I will announce moves and board status.');
    } else {
      this.speak('Voice mode disabled.');
      if (this.synthesis) this.synthesis.cancel();
    }
  }

  speak(text: string) {
    if (this.synthesis && this.voiceEnabled) {
      this.synthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.voiceRate;
      utterance.pitch = this.voicePitch;
      utterance.volume = 1;
      this.synthesis.speak(utterance);
      this.lastSpokenText = text;
    }
  }

  repeatLastMessage() {
    if (this.lastSpokenText && this.voiceEnabled) {
      this.speak(this.lastSpokenText);
    } else if (!this.voiceEnabled) {
      this.speak('Voice mode is disabled. Please enable voice mode first.');
    } else {
      this.speak('No previous message to repeat.');
    }
  }

  announceBoard() {
    if (!this.voiceEnabled) {
      this.speak('Voice mode is disabled. Enabling voice mode to announce board.');
      this.voiceEnabled = true;
    }
    
    let announcement = 'Current board position: ';
    const board = this.board;
    
    // Announce pieces by rank, starting from rank 8
    for (let rank = 8; rank >= 1; rank--) {
      const rankIndex = 8 - rank;
      let rankPieces = [];
      
      for (let file = 0; file < 8; file++) {
        const piece = board[rankIndex][file];
        if (piece) {
          const color = piece.charAt(0) === 'w' ? 'White' : 'Black';
          const pieceType = this.getPieceNameFromSymbol(piece.charAt(1));
          const square = this.files[file] + rank;
          rankPieces.push(`${color} ${pieceType} on ${square}`);
        }
      }
      
      if (rankPieces.length > 0) {
        announcement += `Rank ${rank}: ${rankPieces.join(', ')}. `;
      }
    }
    
    // Add game status
    if (this.chess.isCheck()) {
      announcement += ` ${this.chess.turn() === 'w' ? 'White' : 'Black'} is in check. `;
    }
    
    if (this.chess.isCheckmate()) {
      announcement += ` Checkmate! ${this.chess.turn() === 'w' ? 'Black' : 'White'} wins! `;
    } else if (this.chess.isDraw()) {
      announcement += ' The game is a draw. ';
    } else {
      announcement += ` ${this.chess.turn() === 'w' ? 'White' : 'Black'} to move. `;
    }
    
    this.speak(announcement);
  }

  getPieceNameFromSymbol(symbol: string): string {
    const names: Record<string, string> = {
      'K': 'King',
      'Q': 'Queen',
      'R': 'Rook',
      'B': 'Bishop',
      'N': 'Knight',
      'P': 'Pawn'
    };
    return names[symbol.toUpperCase()] || 'Unknown';
  }

  announceMove(moveResult: Move) {
    if (!this.voiceEnabled) return;
    
    let announcement = '';
    const color = moveResult.color === 'w' ? 'White' : 'Black';
    const piece = this.getPieceNameFromSymbol(moveResult.piece);
    
    if (moveResult.san.includes('O-O-O')) {
      announcement = `${color} castles queenside`;
    } else if (moveResult.san.includes('O-O')) {
      announcement = `${color} castles kingside`;
    } else {
      announcement = `${color} ${piece} `;
      
      if (moveResult.captured) {
        const capturedPiece = this.getPieceNameFromSymbol(moveResult.captured);
        announcement += `captures ${capturedPiece} on ${moveResult.to}`;
      } else {
        announcement += `to ${moveResult.to}`;
      }
    }
    
    // Add special annotations
    if (moveResult.san.includes('+')) {
      announcement += ', check';
    }
    if (moveResult.san.includes('#')) {
      announcement += ', checkmate';
    }
    if (moveResult.san.includes('=')) {
      announcement += ', promotes to Queen';
    }
    
    this.speak(announcement);
  }

  get board(): Piece[][] {
    const raw = this.chess.board();
    return raw.map(row =>
      row.map(cell => {
        if (!cell) return '';
        const color = cell.color === 'w' ? 'w' : 'b';
        const piece = cell.type.toUpperCase();
        return (color + piece) as Piece;
      })
    );
  }

  getPieceUrl(piece: Piece): string {
    const urls: Record<Piece, string> = {
      wK: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
      wQ: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
      wR: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
      wB: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
      wN: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
      wP: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
      bK: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
      bQ: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
      bR: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
      bB: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
      bN: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
      bP: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
      '': ''
    };
    return urls[piece];
  }

  getSquareName(row: number, col: number): string {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  isValidSquare(square: unknown): square is Square {
    return typeof square === 'string' && /^[a-h][1-8]$/.test(square);
  }

  playSound(type: 'move' | 'capture') {
    this.ensureSoundReady();
    let audio = type === 'capture' ? this.captureAudio : this.moveAudio;
    try {
      audio.currentTime = 0;
      setTimeout(() => {
        audio.play().catch(()=>{});
      }, 0);
    } catch(e) {}
  }

  onTouchStart(row: number, col: number, event: TouchEvent) {
    this.touchStartSquare = this.getSquareName(row, col);
    event.preventDefault();
  }

  onTouchEnd(row: number, col: number, event: TouchEvent) {
    const endSquare = this.getSquareName(row, col);
    if (this.touchStartSquare && this.touchStartSquare !== endSquare) {
      this.selectedSquare = this.touchStartSquare;
      this.onSquareClick(row, col);
    } else {
      this.onSquareClick(row, col);
    }
    this.touchStartSquare = null;
    event.preventDefault();
  }

  onSquareClick(row: number, col: number) {
    if (this.timeUp) return;
    this.ensureSoundReady();
    const square = this.getSquareName(row, col);

    if (!this.selectedSquare) {
      if (this.isValidSquare(square)) {
        const piece = this.chess.get(square as Square);
        if (piece && piece.color === this.chess.turn()) {
          this.selectedSquare = square;
          this.moveError = '';
          
          // Announce piece selection
          if (this.voiceEnabled) {
            const color = piece.color === 'w' ? 'White' : 'Black';
            const pieceType = this.getPieceNameFromSymbol(piece.type);
            this.speak(`Selected ${color} ${pieceType} on ${square}`);
          }
        } else {
          this.moveError = 'Select your own piece!';
          if (this.voiceEnabled) {
            this.speak('Select your own piece!');
          }
        }
      }
      return;
    }

    if (this.selectedSquare === square) {
      this.selectedSquare = null;
      if (this.voiceEnabled) {
        this.speak('Selection cleared');
      }
      return;
    }

    if (!this.isValidSquare(this.selectedSquare) || !this.isValidSquare(square)) {
      this.moveError = 'Invalid square!';
      this.selectedSquare = null;
      if (this.voiceEnabled) {
        this.speak('Invalid square!');
      }
      return;
    }

    const legalMoves = this.chess.moves({ square: this.selectedSquare as Square, verbose: true });
    const isLegal = legalMoves.some(m => m.to === square);

    if (!isLegal) {
      this.moveError = 'Illegal move!';
      this.selectedSquare = null;
      if (this.voiceEnabled) {
        this.speak('Illegal move!');
      }
      return;
    }

    let moveResult = this.chess.move({ from: this.selectedSquare as Square, to: square as Square });

    if (!moveResult) {
      const piece = this.chess.get(this.selectedSquare as Square);
      if (piece && piece.type === 'p' && (square[1] === '8' || square[1] === '1')) {
        moveResult = this.chess.move({
          from: this.selectedSquare as Square,
          to: square as Square,
          promotion: 'q'
        });
      }
    }

    if (moveResult) {
      this.playSound(moveResult.captured ? 'capture' : 'move');
      this.moveError = '';
      this.announceMove(moveResult);
      this.switchTimer();
      
      // Check for game end conditions
      setTimeout(() => {
        if (this.chess.isCheckmate()) {
          const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
          this.speak(`Checkmate! ${winner} wins the game!`);
        } else if (this.chess.isDraw()) {
          this.speak('The game is a draw!');
        } else if (this.chess.isCheck()) {
          const inCheck = this.chess.turn() === 'w' ? 'White' : 'Black';
          this.speak(`${inCheck} is in check!`);
        }
      }, 1000);
    } else {
      this.moveError = 'Invalid move!';
      if (this.voiceEnabled) {
        this.speak('Invalid move!');
      }
    }
    this.selectedSquare = null;
    setTimeout(() => { this.recognizedVoiceMove = ''; }, 4000);
  }

  movePiece(move: string) {
    if (this.timeUp) return;
    this.ensureSoundReady();
    this.moveError = '';
    move = move.trim().toLowerCase();
    if (!move) return;

    let result = this.chess.move(move);

    // Try coordinate notation with promotion (e.g., e7e8q)
    if (!result && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
      const from = move.slice(0,2);
      const to = move.slice(2,4);
      const promotion = move.length === 5 ? move[4] : undefined;
      result = this.chess.move({ from, to, promotion });
    }

    // NEW: Try parsing "e7 to e8 queen" or "e7 e8 knight"
    if (!result) {
      const promotionMatch = move.match(/([a-h][1-8])\s*(to)?\s*([a-h][1-8])\s*(queen|rook|bishop|knight)?/);
      if (promotionMatch) {
        const from = promotionMatch[1];
        const to = promotionMatch[3];
        let promotion;
        switch (promotionMatch[4]) {
          case 'queen': promotion = 'q'; break;
          case 'rook': promotion = 'r'; break;
          case 'bishop': promotion = 'b'; break;
          case 'knight': promotion = 'n'; break;
        }
        result = this.chess.move({ from, to, promotion });
      }
    }

    if (!result) {
      this.moveError = 'Invalid move! Use e4, Nf3, exd5, or e2e4.';
      if (this.voiceEnabled) {
        this.speak('Invalid move! Please try again.');
      }
    } else {
      this.playSound(result.captured ? 'capture' : 'move');
      this.announceMove(result);
      this.switchTimer();
      
      // Check for game end conditions
      setTimeout(() => {
        if (this.chess.isCheckmate()) {
          const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
          this.speak(`Checkmate! ${winner} wins the game!`);
        } else if (this.chess.isDraw()) {
          this.speak('The game is a draw!');
        } else if (this.chess.isCheck()) {
          const inCheck = this.chess.turn() === 'w' ? 'White' : 'Black';
          this.speak(`${inCheck} is in check!`);
        }
      }, 1000);
    }
    this.moveInput = '';
    this.selectedSquare = null;
    setTimeout(() => { this.recognizedVoiceMove = ''; }, 4000);
  }

  get fen(): string {
    return this.chess.fen();
  }

  get pgn(): string {
    return this.chess.pgn();
  }

  get moveHistory(): string[] {
    return this.chess.history({ verbose: true }).map((m: Move) => m.san);
  }

  reset() {
    this.chess.reset();
    this.moveError = '';
    this.moveInput = '';
    this.selectedSquare = null;
    this.whiteTime = 5 * 60;
    this.blackTime = 5 * 60;
    this.activeColor = 'w';
    this.timeUp = '';
    this.startTimer();
    if (this.voiceEnabled) {
      this.speak('Game reset. White to move.');
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.timeUp) return;
      if (this.activeColor === 'w') {
        if (this.whiteTime > 0) {
          this.whiteTime--;
          if (this.whiteTime === 0) {
            this.timeUp = 'w';
            if (this.voiceEnabled) {
              this.speak('White time is up! Black wins on time.');
            }
          }
        }
      } else {
        if (this.blackTime > 0) {
          this.blackTime--;
          if (this.blackTime === 0) {
            this.timeUp = 'b';
            if (this.voiceEnabled) {
              this.speak('Black time is up! White wins on time.');
            }
          }
        }
      }
    }, 1000);
  }

  switchTimer() {
    this.activeColor = this.chess.turn();
    this.startTimer();
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  startListening() {
    if (this.timeUp) return;
    this.ensureSoundReady();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.moveError = 'Speech recognition not supported in this browser.';
      if (this.voiceEnabled) {
        this.speak('Speech recognition not supported in this browser.');
      }
      return;
    }

    if (this.isListening) {
      if (this.recognition) {
        this.recognition.abort();
        this.isListening = false;
      }
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.moveError = '';
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      this.recognizedVoiceMove = transcript;
      this.moveInput = transcript;
      this.movePiece(transcript);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      this.moveError = `Speech recognition error: ${event.error}`;
      if (this.voiceEnabled) {
        this.speak(`Speech recognition error: ${event.error}. Please try again.`);
      }
    };

    this.recognition.start();
  }
}
