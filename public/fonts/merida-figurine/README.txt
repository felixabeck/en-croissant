ChessRiddle Merida figurine font - corresponding source
=======================================================

merida-figurine.woff2 supplies the chess figurines (U+2654-U+265F) that
ChessRiddle shows inside running text. It is derived from the Merida piece
set by Felix Kling.
The figurine font and its generator are licensed GPLv2+ (GNU General Public License, version 2 or any later version); licence text: src/app/fonts/merida-figurine/COPYING.txt
The twelve Merida SVGs below are the figurine font's artwork, under the same GPLv2+ terms.

Files, by path relative to this directory, one per line:

README.txt - this index.
src/app/fonts/merida-figurine/COPYING.txt - the GNU GPL version 2 licence text.
scripts/build-figurine-font.py - the generator that compiles the figurine font, GPLv2+.
src/lib/constants/pieces.ts - build input: PIECE_SYMBOLS, the code point each piece becomes.
src/app/fonts/inter/inter-latin.woff2 - build input: the generator copies its vertical metrics; SIL Open Font License 1.1 (OFL).
src/app/fonts/inter/OFL.txt - the SIL Open Font License 1.1 text for inter-latin.woff2.
public/pieces/merida/wK.svg - Merida white king.
public/pieces/merida/wQ.svg - Merida white queen.
public/pieces/merida/wR.svg - Merida white rook.
public/pieces/merida/wB.svg - Merida white bishop.
public/pieces/merida/wN.svg - Merida white knight.
public/pieces/merida/wP.svg - Merida white pawn.
public/pieces/merida/bK.svg - Merida black king.
public/pieces/merida/bQ.svg - Merida black queen.
public/pieces/merida/bR.svg - Merida black rook.
public/pieces/merida/bB.svg - Merida black bishop.
public/pieces/merida/bN.svg - Merida black knight.
public/pieces/merida/bP.svg - Merida black pawn.

Rebuilding: save every file above at its relative path under one directory,
then run the regeneration command from the module docstring of
scripts/build-figurine-font.py in that directory. The output is written to
src/app/fonts/merida-figurine/merida-figurine.woff2.
