import { type SeedPhrase, phrase } from './schema';

export const PHRASES_EN: SeedPhrase[] = [
  phrase('B1', 'on the same page', 'agreeing about something or having the same understanding', "Let's review the plan so we're all on the same page.", { note: 'Very common in workplace conversations.', tags: ['professional'] }),
  phrase('B1', 'get the hang of', 'to learn how to do something, especially after some practice', 'The app was confusing at first, but I soon got the hang of it.'),
  phrase('B1', 'out of the blue', 'unexpectedly; without any warning', 'She called me out of the blue after ten years.'),
  phrase('B1', 'keep someone in the loop', 'to keep someone informed about developments', 'Please keep me in the loop about the release date.', { tags: ['professional'] }),
  phrase('B1', 'in a nutshell', 'in very few words; briefly', 'In a nutshell, we need more time and fewer meetings.'),
  phrase('B1', 'call it a day', 'to stop working on something for the rest of the day', "We've fixed the main issue; let's call it a day.", { tags: ['professional', 'general'] }),
  phrase('B2', 'touch base', 'to briefly contact someone to check how things are going', "I'll touch base with the designer after lunch.", { note: 'Informal business English.', tags: ['business', 'professional'] }),
  phrase('B2', 'a blessing in disguise', 'something that seems bad at first but turns out to be good', 'Missing the train was a blessing in disguise; I met an old friend at the station.'),
  phrase('B2', 'cut corners', 'to do something badly or cheaply to save time or money', "Don't cut corners on testing before a release.", { tags: ['software', 'business'] }),
  phrase('B2', 'bear in mind', 'to remember and consider something', 'Bear in mind that the office closes early on Fridays.'),
  phrase('B2', 'the ball is in your court', 'it is now your turn to act or make a decision', "I've sent my offer, so the ball is in your court now.", { tags: ['business'] }),
  phrase('B2', 'back to the drawing board', 'time to start again because a plan or idea has failed', "The prototype failed every test, so it's back to the drawing board.", { tags: ['software', 'business'] }),
  phrase('B2', 'a steep learning curve', 'a situation in which you have to learn a lot very quickly', 'Moving into management involved a steep learning curve.', { tags: ['professional'] }),
  phrase('B2', 'food for thought', 'something that is worth thinking about carefully', 'Your comments on the design gave me food for thought.'),
  phrase('B2', 'play it by ear', 'to decide what to do as a situation develops instead of planning ahead', "We don't have a fixed plan for Saturday; we'll play it by ear.", { tags: ['travel', 'general'] }),
  phrase('B2', 'beat around the bush', 'to avoid talking directly about what is important', 'Stop beating around the bush and tell me what happened.', { note: 'Usually used in the negative or as a request: "Don\'t beat around the bush."' }),
  phrase('C1', 'by and large', 'on the whole; generally speaking', 'By and large, the feedback was positive.', { note: 'Slightly formal; common in writing.', tags: ['academic'] }),
  phrase('C1', 'hit the ground running', 'to start a new activity quickly and effectively', 'New hires get a clear checklist so they can hit the ground running.', { tags: ['professional'] }),
  phrase('C1', 'a double-edged sword', 'something that has both good and bad effects', 'Remote work is a double-edged sword: more flexibility, but less contact.'),
  phrase('C1', 'the elephant in the room', 'an obvious problem that people avoid talking about', 'The budget cut was the elephant in the room during the meeting.', { tags: ['business'] }),
];
