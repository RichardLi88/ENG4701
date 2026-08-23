# Program Reduction

This context describes how reduction attempts and their effects on a program are presented for analysis.

## Language

**Accepted candidate**:
A reduction candidate whose proposed program became the accepted next state. Every accepted candidate is represented by an accepted step linked to that candidate.
_Avoid_: Committed candidate

**Cumulative token reduction**:
The difference between the original program's token count and its token count after an accepted candidate. It includes changes made by intervening system steps, although those steps are not themselves plotted as candidates.
