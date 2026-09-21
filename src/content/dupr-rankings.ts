/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-09-21.
 *
 * Source pages:
 *   - https://www.dupr.com/rankings (Open + Junior)
 *   - https://www.dupr.com/continental-rankings/{asia,north-america,
 *     south-america,australia-oceania,europe}
 *
 * Each scope has 4 formats (men's singles, women's singles, men's
 * doubles, women's doubles); top 25 per format.
 *
 * Refresh by running scripts/parse-dupr.py and committing the diff.
 * Phase 2 plan: replace with a `dupr-ingest` Supabase edge function +
 * `dupr_rankings` table that the page reads from at runtime.
 */

export type DuprFormat =
  | "mens-singles"
  | "womens-singles"
  | "mens-doubles"
  | "womens-doubles"
  // Sprint A6 (2026-05-27) — vietnam scope formats (aggregated; profiles has
  // no gender column yet so mens/womens cannot be split). Hidden from
  // non-vietnam tabs via getAvailableFormats() below.
  | "singles"
  | "doubles";
export type DuprScope =
  | "open"
  | "junior"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania"
  | "europe"
  // Sprint A6 (2026-05-27) — national scope, currently Vietnam-only. Reads
  // from public.profiles via dupr_leaderboard_vietnam() RPC at runtime
  // rather than the static const below. UI branches on scope === "vietnam".
  | "vietnam";

export interface DuprPlayer {
  rank: number;
  name: string;
  age: number | null;
  rating: number | null;
}

export const DUPR_RANKINGS: Record<
  Exclude<DuprScope, "vietnam">,
  Record<Exclude<DuprFormat, "singles" | "doubles">, DuprPlayer[]>
> = {
  "open": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": 27,
        "rating": 7.121
      },
      {
        "rank": 2,
        "name": "JW Johnson",
        "age": 24,
        "rating": 7.006
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": 20,
        "rating": 6.943
      },
      {
        "rank": 4,
        "name": "Gabriel Tardio",
        "age": 20,
        "rating": 6.923
      },
      {
        "rank": 5,
        "name": "Andrei Daescu",
        "age": 37,
        "rating": 6.889
      },
      {
        "rank": 6,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.881
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.708
      },
      {
        "rank": 8,
        "name": "Riley Newman",
        "age": 33,
        "rating": 6.688
      },
      {
        "rank": 9,
        "name": "Eric Oncins",
        "age": 24,
        "rating": 6.688
      },
      {
        "rank": 10,
        "name": "Jay Devilliers",
        "age": 31,
        "rating": 6.616
      },
      {
        "rank": 11,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.598
      },
      {
        "rank": 12,
        "name": "CJ Klinger",
        "age": 20,
        "rating": 6.563
      },
      {
        "rank": 13,
        "name": "Nicolas Acevedo",
        "age": 26,
        "rating": 6.547
      },
      {
        "rank": 14,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.546
      },
      {
        "rank": 15,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.544
      },
      {
        "rank": 16,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.542
      },
      {
        "rank": 17,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.507
      },
      {
        "rank": 18,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.494
      },
      {
        "rank": 19,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.451
      },
      {
        "rank": 20,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.392
      },
      {
        "rank": 21,
        "name": "Pablo Tellez",
        "age": 31,
        "rating": 6.385
      },
      {
        "rank": 22,
        "name": "Augustus Ge",
        "age": 29,
        "rating": 6.345
      },
      {
        "rank": 23,
        "name": "Tyson Mcguffin",
        "age": 37,
        "rating": 6.328
      },
      {
        "rank": 24,
        "name": "Jack Munro",
        "age": 22,
        "rating": 6.323
      },
      {
        "rank": 25,
        "name": "Matt Wright",
        "age": 49,
        "rating": 6.318
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.987
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 26,
        "rating": 6.598
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.306
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 6.298
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.273
      },
      {
        "rank": 6,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.262
      },
      {
        "rank": 7,
        "name": "Rachel Rohrabacher",
        "age": 29,
        "rating": 6.238
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.231
      },
      {
        "rank": 9,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.228
      },
      {
        "rank": 10,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.188
      },
      {
        "rank": 11,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.121
      },
      {
        "rank": 12,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.115
      },
      {
        "rank": 13,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 6.103
      },
      {
        "rank": 14,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.082
      },
      {
        "rank": 15,
        "name": "Mariana Humberg",
        "age": 30,
        "rating": 6.042
      },
      {
        "rank": 16,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.027
      },
      {
        "rank": 17,
        "name": "Danni-Elle Townsend",
        "age": 23,
        "rating": 6.025
      },
      {
        "rank": 18,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 6.024
      },
      {
        "rank": 19,
        "name": "Jillian Braverman",
        "age": 36,
        "rating": 6.007
      },
      {
        "rank": 20,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 6.002
      },
      {
        "rank": 21,
        "name": "Vivian Glozman",
        "age": 26,
        "rating": 5.993
      },
      {
        "rank": 22,
        "name": "Megan Fudge",
        "age": 38,
        "rating": 5.986
      },
      {
        "rank": 23,
        "name": "Lacy Schneemann",
        "age": 29,
        "rating": 5.974
      },
      {
        "rank": 24,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 5.946
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.942
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": 33,
        "rating": 6.803
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.772
      },
      {
        "rank": 3,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.699
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.581
      },
      {
        "rank": 5,
        "name": "Jack Sock",
        "age": 33,
        "rating": 6.533
      },
      {
        "rank": 6,
        "name": "John Goins",
        "age": 18,
        "rating": 6.518
      },
      {
        "rank": 7,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.517
      },
      {
        "rank": 8,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.486
      },
      {
        "rank": 9,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.448
      },
      {
        "rank": 10,
        "name": "Zane Ford",
        "age": 21,
        "rating": 6.431
      },
      {
        "rank": 11,
        "name": "Jaume Martinez Vich",
        "age": 32,
        "rating": 6.424
      },
      {
        "rank": 12,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.395
      },
      {
        "rank": 13,
        "name": "Dusty Boyer",
        "age": 33,
        "rating": 6.354
      },
      {
        "rank": 14,
        "name": "JW Johnson",
        "age": 24,
        "rating": 6.31
      },
      {
        "rank": 15,
        "name": "Mohaned Alhouni",
        "age": 30,
        "rating": 6.292
      },
      {
        "rank": 16,
        "name": "Matthew Barlow",
        "age": 32,
        "rating": 6.285
      },
      {
        "rank": 17,
        "name": "Dylan Frazier",
        "age": 24,
        "rating": 6.269
      },
      {
        "rank": 18,
        "name": "Adam Harvey",
        "age": 25,
        "rating": 6.259
      },
      {
        "rank": 19,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.257
      },
      {
        "rank": 20,
        "name": "Nam Ly Hoang",
        "age": 29,
        "rating": 6.245
      },
      {
        "rank": 21,
        "name": "Luca Mack",
        "age": 26,
        "rating": 6.244
      },
      {
        "rank": 22,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.24
      },
      {
        "rank": 23,
        "name": "Donald Young",
        "age": 36,
        "rating": 6.237
      },
      {
        "rank": 24,
        "name": "Ronan Camron",
        "age": 21,
        "rating": 6.235
      },
      {
        "rank": 25,
        "name": "Yates Johnson",
        "age": 32,
        "rating": 6.218
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.453
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": 29,
        "rating": 6.175
      },
      {
        "rank": 3,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.105
      },
      {
        "rank": 4,
        "name": "Katerina Stewart",
        "age": 28,
        "rating": 6.043
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": 26,
        "rating": 6.004
      },
      {
        "rank": 6,
        "name": "Lea Jansen",
        "age": 33,
        "rating": 5.882
      },
      {
        "rank": 7,
        "name": "Seone Mendez",
        "age": 27,
        "rating": 5.875
      },
      {
        "rank": 8,
        "name": "Brooke Buckner",
        "age": 34,
        "rating": 5.874
      },
      {
        "rank": 9,
        "name": "Kaitlyn Christian",
        "age": 34,
        "rating": 5.864
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.801
      },
      {
        "rank": 11,
        "name": "Genie Bouchard",
        "age": 32,
        "rating": 5.769
      },
      {
        "rank": 12,
        "name": "Judit Castillo Gargallo",
        "age": 27,
        "rating": 5.764
      },
      {
        "rank": 13,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 5.759
      },
      {
        "rank": 14,
        "name": "Sahra Dennehy",
        "age": 23,
        "rating": 5.716
      },
      {
        "rank": 15,
        "name": "Mary Brascia",
        "age": 26,
        "rating": 5.684
      },
      {
        "rank": 16,
        "name": "Rika Fujiwara",
        "age": 44,
        "rating": 5.684
      },
      {
        "rank": 17,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.678
      },
      {
        "rank": 18,
        "name": "Chao Yi Wang",
        "age": 24,
        "rating": 5.664
      },
      {
        "rank": 19,
        "name": "Trang Huynh",
        "age": 32,
        "rating": 5.66
      },
      {
        "rank": 20,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 5.64
      },
      {
        "rank": 21,
        "name": "Isabella Dunlap",
        "age": 26,
        "rating": 5.636
      },
      {
        "rank": 22,
        "name": "Kao Pei Chuan",
        "age": 31,
        "rating": 5.635
      },
      {
        "rank": 23,
        "name": "Jorja Johnson",
        "age": 19,
        "rating": 5.62
      },
      {
        "rank": 24,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.611
      },
      {
        "rank": 25,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.603
      }
    ]
  },
  "junior": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.237
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.12
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.073
      },
      {
        "rank": 4,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 6.012
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 6.003
      },
      {
        "rank": 6,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.812
      },
      {
        "rank": 7,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.786
      },
      {
        "rank": 8,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.755
      },
      {
        "rank": 9,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.742
      },
      {
        "rank": 10,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.71
      },
      {
        "rank": 11,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.677
      },
      {
        "rank": 12,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.657
      },
      {
        "rank": 13,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.651
      },
      {
        "rank": 14,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.648
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.629
      },
      {
        "rank": 16,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.622
      },
      {
        "rank": 17,
        "name": "Indy Dagnall",
        "age": 16,
        "rating": 5.612
      },
      {
        "rank": 18,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.606
      },
      {
        "rank": 19,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.605
      },
      {
        "rank": 20,
        "name": "Andre Mercado",
        "age": 16,
        "rating": 5.595
      },
      {
        "rank": 21,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.581
      },
      {
        "rank": 22,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.542
      },
      {
        "rank": 23,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.54
      },
      {
        "rank": 24,
        "name": "Jayce Landheer",
        "age": 17,
        "rating": 5.538
      },
      {
        "rank": 25,
        "name": "Francis Chi",
        "age": 14,
        "rating": 5.536
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.715
      },
      {
        "rank": 2,
        "name": "Ella Yeh",
        "age": 16,
        "rating": 5.59
      },
      {
        "rank": 3,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.561
      },
      {
        "rank": 4,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.481
      },
      {
        "rank": 5,
        "name": "Aline Morales",
        "age": 15,
        "rating": 5.462
      },
      {
        "rank": 6,
        "name": "Averry Chew",
        "age": 17,
        "rating": 5.459
      },
      {
        "rank": 7,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.439
      },
      {
        "rank": 8,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.425
      },
      {
        "rank": 9,
        "name": "Adalynn Lund",
        "age": 16,
        "rating": 5.359
      },
      {
        "rank": 10,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.347
      },
      {
        "rank": 11,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.335
      },
      {
        "rank": 12,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.327
      },
      {
        "rank": 13,
        "name": "Jaeda Minniefield",
        "age": 16,
        "rating": 5.307
      },
      {
        "rank": 14,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.253
      },
      {
        "rank": 15,
        "name": "Mary McGowan",
        "age": 17,
        "rating": 5.228
      },
      {
        "rank": 16,
        "name": "Ariana Ajani",
        "age": 15,
        "rating": 5.224
      },
      {
        "rank": 17,
        "name": "Mary Monson",
        "age": 17,
        "rating": 5.175
      },
      {
        "rank": 18,
        "name": "Kayla Williams",
        "age": 16,
        "rating": 5.154
      },
      {
        "rank": 19,
        "name": "CC Eleven Sacca",
        "age": 14,
        "rating": 5.15
      },
      {
        "rank": 20,
        "name": "Jade Rau",
        "age": 16,
        "rating": 5.125
      },
      {
        "rank": 21,
        "name": "E Elenga",
        "age": 17,
        "rating": 5.103
      },
      {
        "rank": 22,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.101
      },
      {
        "rank": 23,
        "name": "Victoria Nguyen",
        "age": 17,
        "rating": 5.084
      },
      {
        "rank": 24,
        "name": "Emily Cho",
        "age": 16,
        "rating": 5.081
      },
      {
        "rank": 25,
        "name": "Naomi Amalsadiwala",
        "age": 16,
        "rating": 5.064
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.518
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.24
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.217
      },
      {
        "rank": 4,
        "name": "George Rangelov",
        "age": 18,
        "rating": 5.928
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 17,
        "rating": 5.901
      },
      {
        "rank": 6,
        "name": "Dale Kim",
        "age": 18,
        "rating": 5.892
      },
      {
        "rank": 7,
        "name": "Jaxon Madsen",
        "age": 18,
        "rating": 5.816
      },
      {
        "rank": 8,
        "name": "Indy Dagnall",
        "age": 16,
        "rating": 5.658
      },
      {
        "rank": 9,
        "name": "Jace Morris",
        "age": 17,
        "rating": 5.648
      },
      {
        "rank": 10,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.555
      },
      {
        "rank": 11,
        "name": "Mauro Garcia Sanchez",
        "age": 18,
        "rating": 5.553
      },
      {
        "rank": 12,
        "name": "Andrew Caldarella",
        "age": 16,
        "rating": 5.538
      },
      {
        "rank": 13,
        "name": "Karthik Ganesh",
        "age": 18,
        "rating": 5.514
      },
      {
        "rank": 14,
        "name": "Mateusz Matysik",
        "age": 18,
        "rating": 5.502
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 17,
        "rating": 5.45
      },
      {
        "rank": 16,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.446
      },
      {
        "rank": 17,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.44
      },
      {
        "rank": 18,
        "name": "Ben Herrick",
        "age": 17,
        "rating": 5.434
      },
      {
        "rank": 19,
        "name": "Braden Jacobson",
        "age": 16,
        "rating": 5.411
      },
      {
        "rank": 20,
        "name": "Ben Slive",
        "age": 16,
        "rating": 5.41
      },
      {
        "rank": 21,
        "name": "Dylan Lewis",
        "age": 18,
        "rating": 5.405
      },
      {
        "rank": 22,
        "name": "heyonglin",
        "age": 16,
        "rating": 5.404
      },
      {
        "rank": 23,
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.383
      },
      {
        "rank": 24,
        "name": "Lucas Riffe",
        "age": 16,
        "rating": 5.374
      },
      {
        "rank": 25,
        "name": "Arwid Dahlin",
        "age": 17,
        "rating": 5.324
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.801
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.678
      },
      {
        "rank": 3,
        "name": "Jalina Ingram",
        "age": 18,
        "rating": 5.316
      },
      {
        "rank": 4,
        "name": "Averry Chew",
        "age": 17,
        "rating": 5.199
      },
      {
        "rank": 5,
        "name": "Kei Sawaki",
        "age": 15,
        "rating": 5.149
      },
      {
        "rank": 6,
        "name": "Emma Nelson",
        "age": 15,
        "rating": 5.128
      },
      {
        "rank": 7,
        "name": "Huong Dan Linh",
        "age": 14,
        "rating": 5.069
      },
      {
        "rank": 8,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 4.93
      },
      {
        "rank": 9,
        "name": "Lauren Gosling",
        "age": 15,
        "rating": 4.927
      },
      {
        "rank": 10,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 4.887
      },
      {
        "rank": 11,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 4.861
      },
      {
        "rank": 12,
        "name": "Kayla Williams",
        "age": 16,
        "rating": 4.841
      },
      {
        "rank": 13,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.84
      },
      {
        "rank": 14,
        "name": "Jade Rau",
        "age": 16,
        "rating": 4.821
      },
      {
        "rank": 15,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.785
      },
      {
        "rank": 16,
        "name": "Isadora Campi",
        "age": 18,
        "rating": 4.772
      },
      {
        "rank": 17,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.734
      },
      {
        "rank": 18,
        "name": "Caroline Maguire",
        "age": 14,
        "rating": 4.727
      },
      {
        "rank": 19,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.646
      },
      {
        "rank": 20,
        "name": "Melody Li",
        "age": 12,
        "rating": 4.646
      },
      {
        "rank": 21,
        "name": "Abigail OKelley",
        "age": 18,
        "rating": 4.635
      },
      {
        "rank": 22,
        "name": "Jing Robinson",
        "age": 14,
        "rating": 4.617
      },
      {
        "rank": 23,
        "name": "Stevie Petropouleas",
        "age": 15,
        "rating": 4.597
      },
      {
        "rank": 24,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 4.574
      },
      {
        "rank": 25,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 4.563
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.301
      },
      {
        "rank": 2,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 3,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.181
      },
      {
        "rank": 4,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.172
      },
      {
        "rank": 5,
        "name": "Len Yang",
        "age": null,
        "rating": 6.084
      },
      {
        "rank": 6,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.03
      },
      {
        "rank": 7,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.949
      },
      {
        "rank": 8,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 9,
        "name": "Quan Do",
        "age": null,
        "rating": 5.9
      },
      {
        "rank": 10,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.899
      },
      {
        "rank": 11,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.897
      },
      {
        "rank": 12,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.893
      },
      {
        "rank": 13,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.883
      },
      {
        "rank": 14,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.879
      },
      {
        "rank": 15,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.869
      },
      {
        "rank": 16,
        "name": "Arnav Duarah",
        "age": null,
        "rating": 5.865
      },
      {
        "rank": 17,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.839
      },
      {
        "rank": 18,
        "name": "Sri Aakash Reddiyar",
        "age": null,
        "rating": 5.837
      },
      {
        "rank": 19,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 20,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.79
      },
      {
        "rank": 21,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.75
      },
      {
        "rank": 22,
        "name": "Rougel Aninon",
        "age": null,
        "rating": 5.743
      },
      {
        "rank": 23,
        "name": "James Yu",
        "age": null,
        "rating": 5.731
      },
      {
        "rank": 24,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 25,
        "name": "Yuvraj Ruia",
        "age": null,
        "rating": 5.72
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.848
      },
      {
        "rank": 2,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.836
      },
      {
        "rank": 3,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.798
      },
      {
        "rank": 4,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.783
      },
      {
        "rank": 5,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.769
      },
      {
        "rank": 6,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 7,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.653
      },
      {
        "rank": 8,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.652
      },
      {
        "rank": 9,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.569
      },
      {
        "rank": 10,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 11,
        "name": "Natalie Hur",
        "age": null,
        "rating": 5.507
      },
      {
        "rank": 12,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.471
      },
      {
        "rank": 13,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.47
      },
      {
        "rank": 14,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.461
      },
      {
        "rank": 15,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.396
      },
      {
        "rank": 16,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.383
      },
      {
        "rank": 17,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.379
      },
      {
        "rank": 18,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.354
      },
      {
        "rank": 19,
        "name": "Sophia Huỳnh Trần Ngọc Nhi",
        "age": null,
        "rating": 5.353
      },
      {
        "rank": 20,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.352
      },
      {
        "rank": 21,
        "name": "Naimi Mehta",
        "age": null,
        "rating": 5.348
      },
      {
        "rank": 22,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.339
      },
      {
        "rank": 23,
        "name": "Pearl Amalsadiwala",
        "age": null,
        "rating": 5.332
      },
      {
        "rank": 24,
        "name": "Dionne Lim",
        "age": null,
        "rating": 5.326
      },
      {
        "rank": 25,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.309
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.277
      },
      {
        "rank": 2,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 6.196
      },
      {
        "rank": 3,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.173
      },
      {
        "rank": 4,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 6.151
      },
      {
        "rank": 5,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 6.065
      },
      {
        "rank": 6,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.994
      },
      {
        "rank": 7,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 8,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 9,
        "name": "Kenneth Lee",
        "age": null,
        "rating": 5.844
      },
      {
        "rank": 10,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.822
      },
      {
        "rank": 11,
        "name": "Thomas Yu",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 12,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.724
      },
      {
        "rank": 13,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.705
      },
      {
        "rank": 14,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 15,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.595
      },
      {
        "rank": 16,
        "name": "Sarinreach Leng",
        "age": null,
        "rating": 5.58
      },
      {
        "rank": 17,
        "name": "Aditya Ruhela",
        "age": null,
        "rating": 5.564
      },
      {
        "rank": 18,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.51
      },
      {
        "rank": 19,
        "name": "Vanshik Kapadia",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 20,
        "name": "Heyonglin",
        "age": null,
        "rating": 5.478
      },
      {
        "rank": 21,
        "name": "Hoai Anh Pham",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 22,
        "name": "Timothy Foo Yi Thim",
        "age": null,
        "rating": 5.46
      },
      {
        "rank": 23,
        "name": "Jose Maria Pague",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 24,
        "name": "Diwakar Agarwal",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 25,
        "name": "Aman Patel",
        "age": null,
        "rating": 5.424
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.696
      },
      {
        "rank": 2,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.598
      },
      {
        "rank": 3,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.581
      },
      {
        "rank": 4,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.564
      },
      {
        "rank": 5,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.542
      },
      {
        "rank": 6,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.509
      },
      {
        "rank": 7,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.427
      },
      {
        "rank": 8,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.345
      },
      {
        "rank": 9,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.307
      },
      {
        "rank": 10,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.286
      },
      {
        "rank": 11,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 12,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 13,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.205
      },
      {
        "rank": 14,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.17
      },
      {
        "rank": 15,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.128
      },
      {
        "rank": 16,
        "name": "Huong Dan Linh",
        "age": null,
        "rating": 5.097
      },
      {
        "rank": 17,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.093
      },
      {
        "rank": 18,
        "name": "Seina Shima",
        "age": null,
        "rating": 5.08
      },
      {
        "rank": 19,
        "name": "Anni Xie",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 20,
        "name": "Yuet Magdaleine Wong",
        "age": null,
        "rating": 5.064
      },
      {
        "rank": 21,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.062
      },
      {
        "rank": 22,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.058
      },
      {
        "rank": 23,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.042
      },
      {
        "rank": 24,
        "name": "Lo Pay Jyue",
        "age": null,
        "rating": 5.036
      },
      {
        "rank": 25,
        "name": "Phraephoi Mahanil",
        "age": null,
        "rating": 5.036
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.086
      },
      {
        "rank": 2,
        "name": "Jw Johnson",
        "age": null,
        "rating": 7.036
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.925
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.892
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.703
      },
      {
        "rank": 6,
        "name": "Cj Klinger",
        "age": null,
        "rating": 6.602
      },
      {
        "rank": 7,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.578
      },
      {
        "rank": 8,
        "name": "Will Howells",
        "age": null,
        "rating": 6.511
      },
      {
        "rank": 9,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.472
      },
      {
        "rank": 10,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.448
      },
      {
        "rank": 11,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.44
      },
      {
        "rank": 12,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.375
      },
      {
        "rank": 13,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.347
      },
      {
        "rank": 14,
        "name": "Matt Wright",
        "age": null,
        "rating": 6.321
      },
      {
        "rank": 15,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.319
      },
      {
        "rank": 16,
        "name": "Casey Diamond",
        "age": null,
        "rating": 6.315
      },
      {
        "rank": 17,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.3
      },
      {
        "rank": 18,
        "name": "Richard Livornese Jr",
        "age": null,
        "rating": 6.293
      },
      {
        "rank": 19,
        "name": "Max Manthou",
        "age": null,
        "rating": 6.288
      },
      {
        "rank": 20,
        "name": "Blaine Hovenier",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 21,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.255
      },
      {
        "rank": 22,
        "name": "John Goins",
        "age": null,
        "rating": 6.243
      },
      {
        "rank": 23,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 24,
        "name": "Spencer Lanier",
        "age": null,
        "rating": 6.231
      },
      {
        "rank": 25,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.229
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.967
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.587
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.329
      },
      {
        "rank": 4,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.323
      },
      {
        "rank": 5,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.318
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.256
      },
      {
        "rank": 7,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.239
      },
      {
        "rank": 8,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.184
      },
      {
        "rank": 9,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.167
      },
      {
        "rank": 10,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.145
      },
      {
        "rank": 11,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.121
      },
      {
        "rank": 12,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.106
      },
      {
        "rank": 13,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.054
      },
      {
        "rank": 14,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 6.027
      },
      {
        "rank": 15,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 6.017
      },
      {
        "rank": 16,
        "name": "Audra Spielberger",
        "age": null,
        "rating": 6.014
      },
      {
        "rank": 17,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 6.012
      },
      {
        "rank": 18,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 5.975
      },
      {
        "rank": 19,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.965
      },
      {
        "rank": 20,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.942
      },
      {
        "rank": 21,
        "name": "Angela Simon",
        "age": null,
        "rating": 5.901
      },
      {
        "rank": 22,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.854
      },
      {
        "rank": 23,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.854
      },
      {
        "rank": 24,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.85
      },
      {
        "rank": 25,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.844
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.831
      },
      {
        "rank": 2,
        "name": "Christopher Haworth",
        "age": null,
        "rating": 6.711
      },
      {
        "rank": 3,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.561
      },
      {
        "rank": 4,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.431
      },
      {
        "rank": 5,
        "name": "Ammar Wazir",
        "age": null,
        "rating": 6.383
      },
      {
        "rank": 6,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.358
      },
      {
        "rank": 7,
        "name": "John Goins",
        "age": null,
        "rating": 6.348
      },
      {
        "rank": 8,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.339
      },
      {
        "rank": 9,
        "name": "Camden Chaffin",
        "age": null,
        "rating": 6.314
      },
      {
        "rank": 10,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.309
      },
      {
        "rank": 11,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.294
      },
      {
        "rank": 12,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.245
      },
      {
        "rank": 13,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.238
      },
      {
        "rank": 14,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.233
      },
      {
        "rank": 15,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.218
      },
      {
        "rank": 16,
        "name": "Donald Young",
        "age": null,
        "rating": 6.216
      },
      {
        "rank": 17,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.209
      },
      {
        "rank": 18,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.177
      },
      {
        "rank": 19,
        "name": "Connor Mogle",
        "age": null,
        "rating": 6.152
      },
      {
        "rank": 20,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.122
      },
      {
        "rank": 21,
        "name": "Grayson Goldin",
        "age": null,
        "rating": 6.119
      },
      {
        "rank": 22,
        "name": "Rafa Hewett",
        "age": null,
        "rating": 6.106
      },
      {
        "rank": 23,
        "name": "Ronan Camron",
        "age": null,
        "rating": 6.07
      },
      {
        "rank": 24,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.052
      },
      {
        "rank": 25,
        "name": "Cason Campbell",
        "age": null,
        "rating": 6.046
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.584
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.246
      },
      {
        "rank": 3,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.081
      },
      {
        "rank": 4,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 5.985
      },
      {
        "rank": 5,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.901
      },
      {
        "rank": 6,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.883
      },
      {
        "rank": 7,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.845
      },
      {
        "rank": 8,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.815
      },
      {
        "rank": 9,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.765
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.741
      },
      {
        "rank": 11,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 12,
        "name": "Keilly Ulery",
        "age": null,
        "rating": 5.684
      },
      {
        "rank": 13,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.648
      },
      {
        "rank": 14,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.592
      },
      {
        "rank": 15,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 5.587
      },
      {
        "rank": 16,
        "name": "Isabella Dunlap",
        "age": null,
        "rating": 5.536
      },
      {
        "rank": 17,
        "name": "Jessica Ho",
        "age": null,
        "rating": 5.519
      },
      {
        "rank": 18,
        "name": "Eileen Wang",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 19,
        "name": "Jessie Irvine",
        "age": null,
        "rating": 5.488
      },
      {
        "rank": 20,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 21,
        "name": "Jada Bui",
        "age": null,
        "rating": 5.458
      },
      {
        "rank": 22,
        "name": "Jalina Ingram",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 23,
        "name": "Shannon Pretorius",
        "age": null,
        "rating": 5.425
      },
      {
        "rank": 24,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.417
      },
      {
        "rank": 25,
        "name": "Karin Ptaszek-Kochis",
        "age": null,
        "rating": 5.381
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.865
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.702
      },
      {
        "rank": 3,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.633
      },
      {
        "rank": 4,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.606
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.331
      },
      {
        "rank": 6,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.172
      },
      {
        "rank": 7,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.106
      },
      {
        "rank": 8,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.085
      },
      {
        "rank": 9,
        "name": "Juan Benitez",
        "age": null,
        "rating": 6.056
      },
      {
        "rank": 10,
        "name": "James Delgado",
        "age": null,
        "rating": 5.988
      },
      {
        "rank": 11,
        "name": "Andre Millet",
        "age": null,
        "rating": 5.977
      },
      {
        "rank": 12,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.939
      },
      {
        "rank": 13,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.807
      },
      {
        "rank": 14,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.781
      },
      {
        "rank": 15,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 16,
        "name": "Caio Bardauil",
        "age": null,
        "rating": 5.662
      },
      {
        "rank": 17,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 18,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.527
      },
      {
        "rank": 19,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.524
      },
      {
        "rank": 20,
        "name": "Mario Porcelli",
        "age": null,
        "rating": 5.496
      },
      {
        "rank": 21,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.48
      },
      {
        "rank": 22,
        "name": "Tobias Golberg",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 23,
        "name": "Alex Simon",
        "age": null,
        "rating": 5.443
      },
      {
        "rank": 24,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.434
      },
      {
        "rank": 25,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.414
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.041
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 6.023
      },
      {
        "rank": 3,
        "name": "Lucia White",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 4,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.429
      },
      {
        "rank": 5,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.429
      },
      {
        "rank": 6,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.404
      },
      {
        "rank": 7,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.307
      },
      {
        "rank": 8,
        "name": "Namie Isago",
        "age": null,
        "rating": 5.285
      },
      {
        "rank": 9,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.248
      },
      {
        "rank": 10,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.119
      },
      {
        "rank": 11,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 12,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 5.019
      },
      {
        "rank": 13,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 14,
        "name": "Ali Quintero",
        "age": null,
        "rating": 4.999
      },
      {
        "rank": 15,
        "name": "Eliza De Oliveira Rocha",
        "age": null,
        "rating": 4.933
      },
      {
        "rank": 16,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.927
      },
      {
        "rank": 17,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.904
      },
      {
        "rank": 18,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.883
      },
      {
        "rank": 19,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.878
      },
      {
        "rank": 20,
        "name": "Mariana Jimenez",
        "age": null,
        "rating": 4.818
      },
      {
        "rank": 21,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.746
      },
      {
        "rank": 22,
        "name": "Lina Romero Alarcon",
        "age": null,
        "rating": 4.687
      },
      {
        "rank": 23,
        "name": "Katie Neils",
        "age": null,
        "rating": 4.686
      },
      {
        "rank": 24,
        "name": "Joana Amorim Cortez Dos Santos",
        "age": null,
        "rating": 4.673
      },
      {
        "rank": 25,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.667
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.757
      },
      {
        "rank": 2,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.223
      },
      {
        "rank": 3,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.154
      },
      {
        "rank": 4,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.123
      },
      {
        "rank": 5,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.631
      },
      {
        "rank": 6,
        "name": "James Delgado",
        "age": null,
        "rating": 5.586
      },
      {
        "rank": 7,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 8,
        "name": "Mario Porcelli",
        "age": null,
        "rating": 5.422
      },
      {
        "rank": 9,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.402
      },
      {
        "rank": 10,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.38
      },
      {
        "rank": 11,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.348
      },
      {
        "rank": 12,
        "name": "Ayke Rodrigues",
        "age": null,
        "rating": 5.267
      },
      {
        "rank": 13,
        "name": "Rafael Munehide Kayo",
        "age": null,
        "rating": 5.252
      },
      {
        "rank": 14,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.24
      },
      {
        "rank": 15,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 5.232
      },
      {
        "rank": 16,
        "name": "Caio Silva",
        "age": null,
        "rating": 5.194
      },
      {
        "rank": 17,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.175
      },
      {
        "rank": 18,
        "name": "João Pedro Agulha Fernandes",
        "age": null,
        "rating": 5.138
      },
      {
        "rank": 19,
        "name": "Nicolas Yannuzzi",
        "age": null,
        "rating": 5.119
      },
      {
        "rank": 20,
        "name": "Tommy Calle",
        "age": null,
        "rating": 5.111
      },
      {
        "rank": 21,
        "name": "Thiago Soto",
        "age": null,
        "rating": 5.091
      },
      {
        "rank": 22,
        "name": "Bruno Semino",
        "age": null,
        "rating": 5.087
      },
      {
        "rank": 23,
        "name": "Bernardo Valdes",
        "age": null,
        "rating": 5.068
      },
      {
        "rank": 24,
        "name": "Tony Ottamendi",
        "age": null,
        "rating": 5.028
      },
      {
        "rank": 25,
        "name": "Rodrigo Borrero",
        "age": null,
        "rating": 5.017
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 5.374
      },
      {
        "rank": 2,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.37
      },
      {
        "rank": 3,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.028
      },
      {
        "rank": 4,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.761
      },
      {
        "rank": 5,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 4.739
      },
      {
        "rank": 6,
        "name": "Isadora Campi",
        "age": null,
        "rating": 4.734
      },
      {
        "rank": 7,
        "name": "Míria Nascimento",
        "age": null,
        "rating": 4.601
      },
      {
        "rank": 8,
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.581
      },
      {
        "rank": 9,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.562
      },
      {
        "rank": 10,
        "name": "Giovanna Mandon Grigioni",
        "age": null,
        "rating": 4.51
      },
      {
        "rank": 11,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.402
      },
      {
        "rank": 12,
        "name": "Mia Alva",
        "age": null,
        "rating": 4.381
      },
      {
        "rank": 13,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.336
      },
      {
        "rank": 14,
        "name": "Cristina Verta",
        "age": null,
        "rating": 4.183
      },
      {
        "rank": 15,
        "name": "Valeria Mayta",
        "age": null,
        "rating": 4.162
      },
      {
        "rank": 16,
        "name": "Viviane Rentroia",
        "age": null,
        "rating": 4.15
      },
      {
        "rank": 17,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.077
      },
      {
        "rank": 18,
        "name": "Mariana Negreiros Mariano",
        "age": null,
        "rating": 4.055
      },
      {
        "rank": 19,
        "name": "Giulia Candeloro",
        "age": null,
        "rating": 4.05
      },
      {
        "rank": 20,
        "name": "Roberta Seidl",
        "age": null,
        "rating": 4.032
      },
      {
        "rank": 21,
        "name": "Alejandra Báez",
        "age": null,
        "rating": 3.957
      },
      {
        "rank": 22,
        "name": "Ana Paula Bergmann",
        "age": null,
        "rating": 3.923
      },
      {
        "rank": 23,
        "name": "Ana Frascheri",
        "age": null,
        "rating": 3.861
      },
      {
        "rank": 24,
        "name": "Fernanda Caldas",
        "age": null,
        "rating": 3.772
      },
      {
        "rank": 25,
        "name": "Mariele Cristina Stamm",
        "age": null,
        "rating": 3.742
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 6.012
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.996
      },
      {
        "rank": 3,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.853
      },
      {
        "rank": 4,
        "name": "Andre Mick",
        "age": null,
        "rating": 5.747
      },
      {
        "rank": 5,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.734
      },
      {
        "rank": 6,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.716
      },
      {
        "rank": 7,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.712
      },
      {
        "rank": 8,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.615
      },
      {
        "rank": 9,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.561
      },
      {
        "rank": 10,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.558
      },
      {
        "rank": 11,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.51
      },
      {
        "rank": 12,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.496
      },
      {
        "rank": 13,
        "name": "Tristan Stayt",
        "age": null,
        "rating": 5.416
      },
      {
        "rank": 14,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.397
      },
      {
        "rank": 15,
        "name": "Ethan Butson",
        "age": null,
        "rating": 5.351
      },
      {
        "rank": 16,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 17,
        "name": "Andrew Kratzmann",
        "age": null,
        "rating": 5.32
      },
      {
        "rank": 18,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.311
      },
      {
        "rank": 19,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.29
      },
      {
        "rank": 20,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 21,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.274
      },
      {
        "rank": 22,
        "name": "Chris Turvey",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 23,
        "name": "Jason William Taylor",
        "age": null,
        "rating": 5.251
      },
      {
        "rank": 24,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.248
      },
      {
        "rank": 25,
        "name": "Steve Tindall",
        "age": null,
        "rating": 5.228
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 6.057
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.891
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.806
      },
      {
        "rank": 4,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.771
      },
      {
        "rank": 5,
        "name": "Kelsey Grambeau",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 6,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.694
      },
      {
        "rank": 7,
        "name": "Somer Dallabona",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 8,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.641
      },
      {
        "rank": 9,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.569
      },
      {
        "rank": 10,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.565
      },
      {
        "rank": 11,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.428
      },
      {
        "rank": 12,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.383
      },
      {
        "rank": 13,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.283
      },
      {
        "rank": 14,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 15,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.257
      },
      {
        "rank": 16,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.235
      },
      {
        "rank": 17,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 18,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 5.128
      },
      {
        "rank": 19,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.114
      },
      {
        "rank": 20,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.109
      },
      {
        "rank": 21,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.105
      },
      {
        "rank": 22,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.065
      },
      {
        "rank": 23,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.027
      },
      {
        "rank": 24,
        "name": "Bee Horsley",
        "age": null,
        "rating": 5.014
      },
      {
        "rank": 25,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 4.964
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.992
      },
      {
        "rank": 2,
        "name": "Robbie Lee",
        "age": null,
        "rating": 5.852
      },
      {
        "rank": 3,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.705
      },
      {
        "rank": 4,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.511
      },
      {
        "rank": 5,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.425
      },
      {
        "rank": 6,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 7,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.378
      },
      {
        "rank": 8,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 9,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.359
      },
      {
        "rank": 10,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 11,
        "name": "Matthew Kouznetsov",
        "age": null,
        "rating": 5.313
      },
      {
        "rank": 12,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.293
      },
      {
        "rank": 13,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.184
      },
      {
        "rank": 14,
        "name": "Michael Massih",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 15,
        "name": "Jason William Taylor",
        "age": null,
        "rating": 5.158
      },
      {
        "rank": 16,
        "name": "James Wilson",
        "age": null,
        "rating": 5.156
      },
      {
        "rank": 17,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.152
      },
      {
        "rank": 18,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.151
      },
      {
        "rank": 19,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.142
      },
      {
        "rank": 20,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.12
      },
      {
        "rank": 21,
        "name": "Nicholas Maleganeas",
        "age": null,
        "rating": 5.086
      },
      {
        "rank": 22,
        "name": "Nigel Lee",
        "age": null,
        "rating": 5.062
      },
      {
        "rank": 23,
        "name": "Sam Aslanowicz",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 24,
        "name": "Ben Murace",
        "age": null,
        "rating": 5.041
      },
      {
        "rank": 25,
        "name": "Chanchai Sookton-Eng",
        "age": null,
        "rating": 5.041
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.902
      },
      {
        "rank": 2,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.76
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.731
      },
      {
        "rank": 4,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.564
      },
      {
        "rank": 5,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.429
      },
      {
        "rank": 6,
        "name": "Lara Giltinan",
        "age": null,
        "rating": 5.404
      },
      {
        "rank": 7,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 8,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.35
      },
      {
        "rank": 9,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.27
      },
      {
        "rank": 10,
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.166
      },
      {
        "rank": 11,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.126
      },
      {
        "rank": 12,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.104
      },
      {
        "rank": 13,
        "name": "Helena Spiridis",
        "age": null,
        "rating": 5.084
      },
      {
        "rank": 14,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 15,
        "name": "Bee Horsley",
        "age": null,
        "rating": 4.978
      },
      {
        "rank": 16,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 4.973
      },
      {
        "rank": 17,
        "name": "Katerina Valos",
        "age": null,
        "rating": 4.967
      },
      {
        "rank": 18,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.966
      },
      {
        "rank": 19,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 20,
        "name": "Crystal Mildwaters",
        "age": null,
        "rating": 4.936
      },
      {
        "rank": 21,
        "name": "Brittany Yang",
        "age": null,
        "rating": 4.936
      },
      {
        "rank": 22,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.875
      },
      {
        "rank": 23,
        "name": "Ange Green",
        "age": null,
        "rating": 4.846
      },
      {
        "rank": 24,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 4.843
      },
      {
        "rank": 25,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.809
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.901
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.566
      },
      {
        "rank": 3,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.518
      },
      {
        "rank": 4,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.469
      },
      {
        "rank": 5,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.339
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.202
      },
      {
        "rank": 7,
        "name": "Anderson Scarpa",
        "age": null,
        "rating": 6.171
      },
      {
        "rank": 8,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.147
      },
      {
        "rank": 9,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.116
      },
      {
        "rank": 10,
        "name": "Dj Young",
        "age": null,
        "rating": 6.046
      },
      {
        "rank": 11,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.042
      },
      {
        "rank": 12,
        "name": "Tom Protzek",
        "age": null,
        "rating": 5.999
      },
      {
        "rank": 13,
        "name": "Henry Boyle",
        "age": null,
        "rating": 5.944
      },
      {
        "rank": 14,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.932
      },
      {
        "rank": 15,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 16,
        "name": "Jaime Lladro",
        "age": null,
        "rating": 5.86
      },
      {
        "rank": 17,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.84
      },
      {
        "rank": 18,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.819
      },
      {
        "rank": 19,
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.813
      },
      {
        "rank": 20,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.801
      },
      {
        "rank": 21,
        "name": "Alvaro Regalado",
        "age": null,
        "rating": 5.795
      },
      {
        "rank": 22,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.78
      },
      {
        "rank": 23,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.757
      },
      {
        "rank": 24,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.742
      },
      {
        "rank": 25,
        "name": "Nicholas Wade",
        "age": null,
        "rating": 5.733
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.208
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.105
      },
      {
        "rank": 3,
        "name": "Megan Fudge",
        "age": null,
        "rating": 6.044
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.889
      },
      {
        "rank": 5,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.863
      },
      {
        "rank": 6,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.811
      },
      {
        "rank": 7,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.776
      },
      {
        "rank": 8,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.772
      },
      {
        "rank": 9,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.739
      },
      {
        "rank": 10,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.729
      },
      {
        "rank": 11,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.666
      },
      {
        "rank": 12,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.628
      },
      {
        "rank": 13,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.579
      },
      {
        "rank": 14,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.569
      },
      {
        "rank": 15,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.568
      },
      {
        "rank": 16,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.562
      },
      {
        "rank": 17,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.554
      },
      {
        "rank": 18,
        "name": "Molly Odonoghue",
        "age": null,
        "rating": 5.548
      },
      {
        "rank": 19,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.537
      },
      {
        "rank": 20,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 21,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.46
      },
      {
        "rank": 22,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.442
      },
      {
        "rank": 23,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.426
      },
      {
        "rank": 24,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.413
      },
      {
        "rank": 25,
        "name": "Giorgia Vitale",
        "age": null,
        "rating": 5.412
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.527
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.409
      },
      {
        "rank": 3,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.25
      },
      {
        "rank": 4,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.033
      },
      {
        "rank": 5,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 6.023
      },
      {
        "rank": 6,
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.959
      },
      {
        "rank": 7,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.927
      },
      {
        "rank": 8,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 5.893
      },
      {
        "rank": 9,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 10,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.872
      },
      {
        "rank": 11,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.871
      },
      {
        "rank": 12,
        "name": "Emilien Burnel",
        "age": null,
        "rating": 5.835
      },
      {
        "rank": 13,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 5.751
      },
      {
        "rank": 14,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.702
      },
      {
        "rank": 15,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.692
      },
      {
        "rank": 16,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.678
      },
      {
        "rank": 17,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.671
      },
      {
        "rank": 18,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.666
      },
      {
        "rank": 19,
        "name": "Shay Hugo",
        "age": null,
        "rating": 5.661
      },
      {
        "rank": 20,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.629
      },
      {
        "rank": 21,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.629
      },
      {
        "rank": 22,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.619
      },
      {
        "rank": 23,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.61
      },
      {
        "rank": 24,
        "name": "Jasper Schaadt",
        "age": null,
        "rating": 5.601
      },
      {
        "rank": 25,
        "name": "James Ling",
        "age": null,
        "rating": 5.591
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.882
      },
      {
        "rank": 2,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.656
      },
      {
        "rank": 3,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.64
      },
      {
        "rank": 4,
        "name": "Helena Jansen",
        "age": null,
        "rating": 5.637
      },
      {
        "rank": 5,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 6,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.471
      },
      {
        "rank": 7,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 8,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.427
      },
      {
        "rank": 9,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.405
      },
      {
        "rank": 10,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.388
      },
      {
        "rank": 11,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.344
      },
      {
        "rank": 12,
        "name": "Maria Tatarnikova",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 13,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.285
      },
      {
        "rank": 14,
        "name": "Francesca Rumi",
        "age": null,
        "rating": 5.216
      },
      {
        "rank": 15,
        "name": "Naomi De Hart",
        "age": null,
        "rating": 5.175
      },
      {
        "rank": 16,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.172
      },
      {
        "rank": 17,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 18,
        "name": "Maria Fernandez Costantino",
        "age": null,
        "rating": 5.148
      },
      {
        "rank": 19,
        "name": "Myriam Enmer",
        "age": null,
        "rating": 5.067
      },
      {
        "rank": 20,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 5.018
      },
      {
        "rank": 21,
        "name": "Emilia Richter",
        "age": null,
        "rating": 5.007
      },
      {
        "rank": 22,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 4.995
      },
      {
        "rank": 23,
        "name": "Selma Suikkanen",
        "age": null,
        "rating": 4.991
      },
      {
        "rank": 24,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 4.981
      },
      {
        "rank": 25,
        "name": "Frida Mudsam",
        "age": null,
        "rating": 4.965
      }
    ]
  }
};


export type DuprScopeGroup = "global" | "continent" | "national";

export const DUPR_SCOPES: { key: DuprScope; labelEn: string; labelVi: string; group: DuprScopeGroup }[] = [
  // National scope first — most prominent for the ~95% Vietnamese userbase.
  { key: "vietnam",           labelEn: "Vietnam",             labelVi: "Việt Nam",        group: "national" },
  { key: "open",              labelEn: "Open",                labelVi: "Mở rộng",         group: "global" },
  { key: "junior",            labelEn: "Junior",              labelVi: "Trẻ",             group: "global" },
  { key: "asia",              labelEn: "Asia",                labelVi: "Châu Á",          group: "continent" },
  { key: "north-america",     labelEn: "North America",       labelVi: "Bắc Mỹ",          group: "continent" },
  { key: "south-america",     labelEn: "South America",       labelVi: "Nam Mỹ",          group: "continent" },
  { key: "australia-oceania", labelEn: "Australia / Oceania", labelVi: "Úc / Châu Đại Dương", group: "continent" },
  { key: "europe",            labelEn: "Europe",              labelVi: "Châu Âu",         group: "continent" },
];

export const DUPR_FORMATS: { key: DuprFormat; labelEn: string; labelVi: string }[] = [
  { key: "mens-singles",   labelEn: "Men's Singles",   labelVi: "Đơn nam" },
  { key: "womens-singles", labelEn: "Women's Singles", labelVi: "Đơn nữ" },
  { key: "mens-doubles",   labelEn: "Men's Doubles",   labelVi: "Đôi nam" },
  { key: "womens-doubles", labelEn: "Women's Doubles", labelVi: "Đôi nữ" },
  { key: "singles",        labelEn: "Singles",         labelVi: "Đơn" },
  { key: "doubles",        labelEn: "Doubles",         labelVi: "Đôi" },
];

// Sprint A6 — per-scope format availability. vietnam uses 2 aggregated
// formats; all other scopes use the 4 gender-split formats.
export function getAvailableFormats(scope: DuprScope): DuprFormat[] {
  if (scope === "vietnam") {
    return ["doubles", "singles"];
  }
  return ["mens-singles", "womens-singles", "mens-doubles", "womens-doubles"];
}

export function defaultFormatForScope(scope: DuprScope): DuprFormat {
  return scope === "vietnam" ? "doubles" : "mens-doubles";
}

export const DUPR_LAST_UPDATED = "2026-09-21";
