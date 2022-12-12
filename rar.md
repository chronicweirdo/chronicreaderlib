# compressed representation overview

- blocks
- each block compressed using combination of LZ77 and Huffman coding
- Huffman trees for each block are independent of previous blocks
- two code trees, one for literal data, one for length, distance pairs to previous data
- code trees of each block appear in a compact form just before the compressed data