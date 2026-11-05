/**
 * DUPR rankings snapshot — parsed from www.dupr.com on 2026-11-02.
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
        "name": "Jw Johnson",
        "age": 24,
        "rating": 7.047
      },
      {
        "rank": 2,
        "name": "Ben Johns",
        "age": 27,
        "rating": 7.032
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": 21,
        "rating": 6.888
      },
      {
        "rank": 4,
        "name": "Andrei Daescu",
        "age": 38,
        "rating": 6.844
      },
      {
        "rank": 5,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.827
      },
      {
        "rank": 6,
        "name": "Gabriel Tardio",
        "age": 21,
        "rating": 6.795
      },
      {
        "rank": 7,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.714
      },
      {
        "rank": 8,
        "name": "Nicolas Acevedo",
        "age": 27,
        "rating": 6.663
      },
      {
        "rank": 9,
        "name": "Eric Oncins",
        "age": 25,
        "rating": 6.653
      },
      {
        "rank": 10,
        "name": "Riley Newman",
        "age": 33,
        "rating": 6.651
      },
      {
        "rank": 11,
        "name": "Cj Klinger",
        "age": 20,
        "rating": 6.601
      },
      {
        "rank": 12,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.542
      },
      {
        "rank": 13,
        "name": "Jay Devilliers",
        "age": 32,
        "rating": 6.483
      },
      {
        "rank": 14,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.463
      },
      {
        "rank": 15,
        "name": "Dylan Frazier",
        "age": 25,
        "rating": 6.458
      },
      {
        "rank": 16,
        "name": "Jaume Martinez Vich",
        "age": 33,
        "rating": 6.454
      },
      {
        "rank": 17,
        "name": "Will Howells",
        "age": 27,
        "rating": 6.448
      },
      {
        "rank": 18,
        "name": "Dekel Bar",
        "age": 33,
        "rating": 6.444
      },
      {
        "rank": 19,
        "name": "Jack Sock",
        "age": 34,
        "rating": 6.428
      },
      {
        "rank": 20,
        "name": "Pablo Tellez",
        "age": 31,
        "rating": 6.332
      },
      {
        "rank": 21,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.331
      },
      {
        "rank": 22,
        "name": "John Goins",
        "age": 18,
        "rating": 6.314
      },
      {
        "rank": 23,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.306
      },
      {
        "rank": 24,
        "name": "Augustus Ge",
        "age": 30,
        "rating": 6.277
      },
      {
        "rank": 25,
        "name": "Richard Livornese Jr",
        "age": 25,
        "rating": 6.273
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.999
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": 27,
        "rating": 6.604
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": 25,
        "rating": 6.403
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": 20,
        "rating": 6.322
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": 28,
        "rating": 6.288
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": 29,
        "rating": 6.259
      },
      {
        "rank": 7,
        "name": "Kate Fahey",
        "age": 30,
        "rating": 6.224
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": 30,
        "rating": 6.189
      },
      {
        "rank": 9,
        "name": "Tina Pisnik",
        "age": 45,
        "rating": 6.175
      },
      {
        "rank": 10,
        "name": "Sofia Sewing",
        "age": 27,
        "rating": 6.174
      },
      {
        "rank": 11,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 6.155
      },
      {
        "rank": 12,
        "name": "Jade Kawamoto",
        "age": 30,
        "rating": 6.138
      },
      {
        "rank": 13,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 6.111
      },
      {
        "rank": 14,
        "name": "Mariechristine Salvas",
        "age": 38,
        "rating": 6.109
      },
      {
        "rank": 15,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": 50,
        "rating": 6.065
      },
      {
        "rank": 16,
        "name": "Mariana Humberg",
        "age": 30,
        "rating": 6.048
      },
      {
        "rank": 17,
        "name": "Meghan Dizon",
        "age": 33,
        "rating": 6.03
      },
      {
        "rank": 18,
        "name": "Lacy Schneemann",
        "age": 30,
        "rating": 6.021
      },
      {
        "rank": 19,
        "name": "Etta Tuionetoa",
        "age": 34,
        "rating": 6.014
      },
      {
        "rank": 20,
        "name": "Katerina Stewart",
        "age": 29,
        "rating": 6.009
      },
      {
        "rank": 21,
        "name": "Audra Spielberger",
        "age": 55,
        "rating": 6.002
      },
      {
        "rank": 22,
        "name": "Danni-Elle Townsend",
        "age": 23,
        "rating": 6.0
      },
      {
        "rank": 23,
        "name": "Jillian Braverman",
        "age": 37,
        "rating": 5.989
      },
      {
        "rank": 24,
        "name": "Megan Fudge",
        "age": 39,
        "rating": 5.967
      },
      {
        "rank": 25,
        "name": "Vivian Glozman",
        "age": 26,
        "rating": 5.951
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": 33,
        "rating": 6.655
      },
      {
        "rank": 2,
        "name": "Hunter Johnson",
        "age": 32,
        "rating": 6.637
      },
      {
        "rank": 3,
        "name": "Federico Staksrud",
        "age": 30,
        "rating": 6.621
      },
      {
        "rank": 4,
        "name": "John Goins",
        "age": 18,
        "rating": 6.614
      },
      {
        "rank": 5,
        "name": "Christian Alshon",
        "age": 26,
        "rating": 6.568
      },
      {
        "rank": 6,
        "name": "Jaume Martinez Vich",
        "age": 33,
        "rating": 6.468
      },
      {
        "rank": 7,
        "name": "Roscoe Bellamy",
        "age": 26,
        "rating": 6.464
      },
      {
        "rank": 8,
        "name": "Ben Johns",
        "age": 27,
        "rating": 6.437
      },
      {
        "rank": 9,
        "name": "Noe Khlif",
        "age": 28,
        "rating": 6.436
      },
      {
        "rank": 10,
        "name": "Jack Sock",
        "age": 34,
        "rating": 6.356
      },
      {
        "rank": 11,
        "name": "Rafael Lenhard",
        "age": 30,
        "rating": 6.337
      },
      {
        "rank": 12,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.319
      },
      {
        "rank": 13,
        "name": "Gabriel Joseph",
        "age": 29,
        "rating": 6.299
      },
      {
        "rank": 14,
        "name": "Ammar Wazir",
        "age": 23,
        "rating": 6.284
      },
      {
        "rank": 15,
        "name": "Adam Harvey",
        "age": 25,
        "rating": 6.257
      },
      {
        "rank": 16,
        "name": "Luca Mack",
        "age": 26,
        "rating": 6.25
      },
      {
        "rank": 17,
        "name": "Yates Johnson",
        "age": 32,
        "rating": 6.249
      },
      {
        "rank": 18,
        "name": "Eric Oncins",
        "age": 25,
        "rating": 6.241
      },
      {
        "rank": 19,
        "name": "Jw Johnson",
        "age": 24,
        "rating": 6.217
      },
      {
        "rank": 20,
        "name": "Zane Ford",
        "age": 22,
        "rating": 6.215
      },
      {
        "rank": 21,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.198
      },
      {
        "rank": 22,
        "name": "Nam Ly Hoang",
        "age": 29,
        "rating": 6.196
      },
      {
        "rank": 23,
        "name": "Matthew Barlow",
        "age": 32,
        "rating": 6.177
      },
      {
        "rank": 24,
        "name": "Connor Garnett",
        "age": 29,
        "rating": 6.165
      },
      {
        "rank": 25,
        "name": "Cason Campbell",
        "age": 20,
        "rating": 6.152
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": 19,
        "rating": 6.704
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": 30,
        "rating": 6.257
      },
      {
        "rank": 3,
        "name": "Katerina Stewart",
        "age": 29,
        "rating": 5.974
      },
      {
        "rank": 4,
        "name": "Andie Dikosavljevic",
        "age": 30,
        "rating": 5.949
      },
      {
        "rank": 5,
        "name": "Kaitlyn Christian",
        "age": 34,
        "rating": 5.89
      },
      {
        "rank": 6,
        "name": "Seone Mendez",
        "age": 27,
        "rating": 5.887
      },
      {
        "rank": 7,
        "name": "Sofia Sewing",
        "age": 27,
        "rating": 5.885
      },
      {
        "rank": 8,
        "name": "Brooke Buckner",
        "age": 34,
        "rating": 5.827
      },
      {
        "rank": 9,
        "name": "Judit Castillo Gargallo",
        "age": 28,
        "rating": 5.793
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": 32,
        "rating": 5.784
      },
      {
        "rank": 11,
        "name": "Domenika Turkovic",
        "age": 26,
        "rating": 5.77
      },
      {
        "rank": 12,
        "name": "Lea Jansen",
        "age": 33,
        "rating": 5.755
      },
      {
        "rank": 13,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.732
      },
      {
        "rank": 14,
        "name": "Marianna Petrei",
        "age": 30,
        "rating": 5.709
      },
      {
        "rank": 15,
        "name": "Sahra Dennehy",
        "age": 24,
        "rating": 5.702
      },
      {
        "rank": 16,
        "name": "Bobbi Oshiro",
        "age": 32,
        "rating": 5.669
      },
      {
        "rank": 17,
        "name": "Keilly Ulery",
        "age": 36,
        "rating": 5.663
      },
      {
        "rank": 18,
        "name": "Helena Jansen",
        "age": 27,
        "rating": 5.66
      },
      {
        "rank": 19,
        "name": "Roos Van Reek",
        "age": 25,
        "rating": 5.639
      },
      {
        "rank": 20,
        "name": "Isabella Dunlap",
        "age": 26,
        "rating": 5.624
      },
      {
        "rank": 21,
        "name": "Yufei Long",
        "age": 27,
        "rating": 5.609
      },
      {
        "rank": 22,
        "name": "Maria Vyshkina",
        "age": 22,
        "rating": 5.559
      },
      {
        "rank": 23,
        "name": "Chao Yi Wang",
        "age": 24,
        "rating": 5.559
      },
      {
        "rank": 24,
        "name": "Amber Policare",
        "age": 28,
        "rating": 5.553
      },
      {
        "rank": 25,
        "name": "Trang Huynh",
        "age": 33,
        "rating": 5.552
      }
    ]
  },
  "junior": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.314
      },
      {
        "rank": 2,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.167
      },
      {
        "rank": 3,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.124
      },
      {
        "rank": 4,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 6.092
      },
      {
        "rank": 5,
        "name": "Tristan Dussault",
        "age": 18,
        "rating": 6.082
      },
      {
        "rank": 6,
        "name": "Ben Slive",
        "age": 17,
        "rating": 5.828
      },
      {
        "rank": 7,
        "name": "Andrew Caldarella",
        "age": 17,
        "rating": 5.824
      },
      {
        "rank": 8,
        "name": "Jace Morris",
        "age": 18,
        "rating": 5.818
      },
      {
        "rank": 9,
        "name": "Francis Chi",
        "age": 14,
        "rating": 5.797
      },
      {
        "rank": 10,
        "name": "Indy Dagnall",
        "age": 17,
        "rating": 5.794
      },
      {
        "rank": 11,
        "name": "Braden Jacobson",
        "age": 17,
        "rating": 5.776
      },
      {
        "rank": 12,
        "name": "Braylon Ohrel",
        "age": 15,
        "rating": 5.771
      },
      {
        "rank": 13,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.754
      },
      {
        "rank": 14,
        "name": "Andre Mercado",
        "age": 17,
        "rating": 5.726
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 18,
        "rating": 5.717
      },
      {
        "rank": 16,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.699
      },
      {
        "rank": 17,
        "name": "Arwid Dahlin",
        "age": 18,
        "rating": 5.69
      },
      {
        "rank": 18,
        "name": "Ahmad Elzarif",
        "age": 18,
        "rating": 5.682
      },
      {
        "rank": 19,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.665
      },
      {
        "rank": 20,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.651
      },
      {
        "rank": 21,
        "name": "Jacob Bolkowy",
        "age": 17,
        "rating": 5.6
      },
      {
        "rank": 22,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.583
      },
      {
        "rank": 23,
        "name": "Andrew Angulo",
        "age": 16,
        "rating": 5.549
      },
      {
        "rank": 24,
        "name": "Jayce Landheer",
        "age": 18,
        "rating": 5.51
      },
      {
        "rank": 25,
        "name": "Aj Marrero",
        "age": 18,
        "rating": 5.51
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.926
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.702
      },
      {
        "rank": 3,
        "name": "Ella Yeh",
        "age": 16,
        "rating": 5.675
      },
      {
        "rank": 4,
        "name": "Averry Chew",
        "age": 18,
        "rating": 5.549
      },
      {
        "rank": 5,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 5.544
      },
      {
        "rank": 6,
        "name": "Mary Mcgowan",
        "age": 18,
        "rating": 5.49
      },
      {
        "rank": 7,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 5.478
      },
      {
        "rank": 8,
        "name": "Jaeda Minniefield",
        "age": 17,
        "rating": 5.399
      },
      {
        "rank": 9,
        "name": "Emma Nelson",
        "age": 16,
        "rating": 5.383
      },
      {
        "rank": 10,
        "name": "Aline Morales",
        "age": 16,
        "rating": 5.37
      },
      {
        "rank": 11,
        "name": "Kei Sawaki",
        "age": 16,
        "rating": 5.343
      },
      {
        "rank": 12,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 5.327
      },
      {
        "rank": 13,
        "name": "Adalynn Lund",
        "age": 17,
        "rating": 5.321
      },
      {
        "rank": 14,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.28
      },
      {
        "rank": 15,
        "name": "Cc Eleven Sacca",
        "age": 15,
        "rating": 5.215
      },
      {
        "rank": 16,
        "name": "Adelie Osher",
        "age": 18,
        "rating": 5.185
      },
      {
        "rank": 17,
        "name": "Jade Rau",
        "age": 17,
        "rating": 5.174
      },
      {
        "rank": 18,
        "name": "Mary Monson",
        "age": 18,
        "rating": 5.165
      },
      {
        "rank": 19,
        "name": "Naomi Amalsadiwala",
        "age": 17,
        "rating": 5.135
      },
      {
        "rank": 20,
        "name": "Emily Cho",
        "age": 17,
        "rating": 5.108
      },
      {
        "rank": 21,
        "name": "Victoria Nguyen",
        "age": 18,
        "rating": 5.064
      },
      {
        "rank": 22,
        "name": "Ella Cosma",
        "age": 17,
        "rating": 5.064
      },
      {
        "rank": 23,
        "name": "Victoria A Simon",
        "age": 16,
        "rating": 5.042
      },
      {
        "rank": 24,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 5.032
      },
      {
        "rank": 25,
        "name": "Stevie Petropouleas",
        "age": 15,
        "rating": 5.029
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "John Goins",
        "age": 18,
        "rating": 6.614
      },
      {
        "rank": 2,
        "name": "Tama Shimabukuro",
        "age": 15,
        "rating": 6.319
      },
      {
        "rank": 3,
        "name": "Camden Chaffin",
        "age": 15,
        "rating": 6.198
      },
      {
        "rank": 4,
        "name": "Tristan Dussault",
        "age": 18,
        "rating": 6.033
      },
      {
        "rank": 5,
        "name": "Daniel Phillips",
        "age": 16,
        "rating": 5.847
      },
      {
        "rank": 6,
        "name": "Braden Jacobson",
        "age": 17,
        "rating": 5.661
      },
      {
        "rank": 7,
        "name": "Ben Herrick",
        "age": 18,
        "rating": 5.654
      },
      {
        "rank": 8,
        "name": "Andrew Caldarella",
        "age": 17,
        "rating": 5.641
      },
      {
        "rank": 9,
        "name": "Jace Morris",
        "age": 18,
        "rating": 5.601
      },
      {
        "rank": 10,
        "name": "Indy Dagnall",
        "age": 17,
        "rating": 5.564
      },
      {
        "rank": 11,
        "name": "Braylon Ohrel",
        "age": 15,
        "rating": 5.537
      },
      {
        "rank": 12,
        "name": "Mackonner Dy",
        "age": 16,
        "rating": 5.531
      },
      {
        "rank": 13,
        "name": "Hoai Anh Pham",
        "age": 15,
        "rating": 5.467
      },
      {
        "rank": 14,
        "name": "Ben Slive",
        "age": 17,
        "rating": 5.462
      },
      {
        "rank": 15,
        "name": "Parth Mody",
        "age": 18,
        "rating": 5.454
      },
      {
        "rank": 16,
        "name": "Wil Shaffer",
        "age": 17,
        "rating": 5.42
      },
      {
        "rank": 17,
        "name": "Arjun Singh",
        "age": 16,
        "rating": 5.411
      },
      {
        "rank": 18,
        "name": "Heyonglin",
        "age": 16,
        "rating": 5.391
      },
      {
        "rank": 19,
        "name": "Ethan Bakalinsky",
        "age": 15,
        "rating": 5.386
      },
      {
        "rank": 20,
        "name": "Lucas Riffe",
        "age": 16,
        "rating": 5.374
      },
      {
        "rank": 21,
        "name": "Will Mackinnon",
        "age": 18,
        "rating": 5.363
      },
      {
        "rank": 22,
        "name": "Alessio Gabbiani",
        "age": 17,
        "rating": 5.35
      },
      {
        "rank": 23,
        "name": "Dev Shah",
        "age": 18,
        "rating": 5.342
      },
      {
        "rank": 24,
        "name": "Jace Howard",
        "age": 18,
        "rating": 5.329
      },
      {
        "rank": 25,
        "name": "Arwid Dahlin",
        "age": 18,
        "rating": 5.324
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Kiora Kunimoto",
        "age": 18,
        "rating": 5.732
      },
      {
        "rank": 2,
        "name": "Cailyn Campbell",
        "age": 16,
        "rating": 5.523
      },
      {
        "rank": 3,
        "name": "Kei Sawaki",
        "age": 16,
        "rating": 5.296
      },
      {
        "rank": 4,
        "name": "Valerie Simon",
        "age": 18,
        "rating": 5.128
      },
      {
        "rank": 5,
        "name": "Huong Dan Linh",
        "age": 14,
        "rating": 5.059
      },
      {
        "rank": 6,
        "name": "Sophia Tran Phuong Anh",
        "age": 18,
        "rating": 4.998
      },
      {
        "rank": 7,
        "name": "Kelly Goodnow",
        "age": 14,
        "rating": 4.996
      },
      {
        "rank": 8,
        "name": "Averry Chew",
        "age": 18,
        "rating": 4.966
      },
      {
        "rank": 9,
        "name": "Stevie Petropouleas",
        "age": 15,
        "rating": 4.898
      },
      {
        "rank": 10,
        "name": "Caroline Maguire",
        "age": 15,
        "rating": 4.895
      },
      {
        "rank": 11,
        "name": "Aria Henare",
        "age": 16,
        "rating": 4.881
      },
      {
        "rank": 12,
        "name": "Elsie Hendershot",
        "age": 13,
        "rating": 4.874
      },
      {
        "rank": 13,
        "name": "Stella BảO Châu",
        "age": 15,
        "rating": 4.87
      },
      {
        "rank": 14,
        "name": "Lauren Gosling",
        "age": 16,
        "rating": 4.829
      },
      {
        "rank": 15,
        "name": "Jaeda Minniefield",
        "age": 17,
        "rating": 4.816
      },
      {
        "rank": 16,
        "name": "Lynn Lim",
        "age": 16,
        "rating": 4.813
      },
      {
        "rank": 17,
        "name": "Jade Rau",
        "age": 17,
        "rating": 4.794
      },
      {
        "rank": 18,
        "name": "Jayda Maldonado",
        "age": 16,
        "rating": 4.785
      },
      {
        "rank": 19,
        "name": "Isadora Campi",
        "age": 18,
        "rating": 4.734
      },
      {
        "rank": 20,
        "name": "Diane Huynh",
        "age": 15,
        "rating": 4.678
      },
      {
        "rank": 21,
        "name": "Athena Leung",
        "age": 18,
        "rating": 4.675
      },
      {
        "rank": 22,
        "name": "Niesha Enja",
        "age": 15,
        "rating": 4.647
      },
      {
        "rank": 23,
        "name": "Natalia Simson",
        "age": 14,
        "rating": 4.644
      },
      {
        "rank": 24,
        "name": "Eliana Ling",
        "age": 18,
        "rating": 4.638
      },
      {
        "rank": 25,
        "name": "Alexandra Seanna Micallef Ampong",
        "age": 13,
        "rating": 4.63
      }
    ]
  },
  "asia": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Jonathan Truong",
        "age": null,
        "rating": 6.244
      },
      {
        "rank": 2,
        "name": "Armaan Bhatia",
        "age": null,
        "rating": 6.212
      },
      {
        "rank": 3,
        "name": "Yuta Funemizu",
        "age": null,
        "rating": 6.096
      },
      {
        "rank": 4,
        "name": "Clyd Du",
        "age": null,
        "rating": 6.08
      },
      {
        "rank": 5,
        "name": "Len Yang",
        "age": null,
        "rating": 6.075
      },
      {
        "rank": 6,
        "name": "Quang Duong",
        "age": null,
        "rating": 6.048
      },
      {
        "rank": 7,
        "name": "Thomas Yu",
        "age": null,
        "rating": 6.017
      },
      {
        "rank": 8,
        "name": "Quan Do",
        "age": null,
        "rating": 6.001
      },
      {
        "rank": 9,
        "name": "Truong Hien",
        "age": null,
        "rating": 5.968
      },
      {
        "rank": 10,
        "name": "Kailas Shekar",
        "age": null,
        "rating": 5.937
      },
      {
        "rank": 11,
        "name": "Sanil Jagtiani",
        "age": null,
        "rating": 5.895
      },
      {
        "rank": 12,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.885
      },
      {
        "rank": 13,
        "name": "Arnav Duarah",
        "age": null,
        "rating": 5.875
      },
      {
        "rank": 14,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.867
      },
      {
        "rank": 15,
        "name": "Harsh Mehta",
        "age": null,
        "rating": 5.846
      },
      {
        "rank": 16,
        "name": "Eric Roddy",
        "age": null,
        "rating": 5.841
      },
      {
        "rank": 17,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.836
      },
      {
        "rank": 18,
        "name": "Eunggwon Kim",
        "age": null,
        "rating": 5.833
      },
      {
        "rank": 19,
        "name": "Altaf Merchant",
        "age": null,
        "rating": 5.812
      },
      {
        "rank": 20,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.793
      },
      {
        "rank": 21,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 5.79
      },
      {
        "rank": 22,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.767
      },
      {
        "rank": 23,
        "name": "Arjun Singh",
        "age": null,
        "rating": 5.754
      },
      {
        "rank": 24,
        "name": "Sarinreach Leng",
        "age": null,
        "rating": 5.746
      },
      {
        "rank": 25,
        "name": "James Yu",
        "age": null,
        "rating": 5.707
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Aibika Kalsarieva",
        "age": null,
        "rating": 5.894
      },
      {
        "rank": 2,
        "name": "Alix Truong",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 3,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.823
      },
      {
        "rank": 4,
        "name": "Kara Wheatley",
        "age": null,
        "rating": 5.797
      },
      {
        "rank": 5,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.728
      },
      {
        "rank": 6,
        "name": "Marisa Ruiz",
        "age": null,
        "rating": 5.679
      },
      {
        "rank": 7,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.628
      },
      {
        "rank": 8,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.592
      },
      {
        "rank": 9,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.516
      },
      {
        "rank": 10,
        "name": "Nicole Eugenio",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 11,
        "name": "Natalie Hur",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 12,
        "name": "Lingwei Kong",
        "age": null,
        "rating": 5.484
      },
      {
        "rank": 13,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.481
      },
      {
        "rank": 14,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.444
      },
      {
        "rank": 15,
        "name": "Sophia HuỳNh TrầN NgọC Nhi",
        "age": null,
        "rating": 5.407
      },
      {
        "rank": 16,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.398
      },
      {
        "rank": 17,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.388
      },
      {
        "rank": 18,
        "name": "Pearl Amalsadiwala",
        "age": null,
        "rating": 5.379
      },
      {
        "rank": 19,
        "name": "Kai Fen Yi",
        "age": null,
        "rating": 5.372
      },
      {
        "rank": 20,
        "name": "Lyn Yuen Choo",
        "age": null,
        "rating": 5.366
      },
      {
        "rank": 21,
        "name": "Kei Sawaki",
        "age": null,
        "rating": 5.343
      },
      {
        "rank": 22,
        "name": "Ken Tam",
        "age": null,
        "rating": 5.336
      },
      {
        "rank": 23,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.323
      },
      {
        "rank": 24,
        "name": "Vritti Sethi",
        "age": null,
        "rating": 5.317
      },
      {
        "rank": 25,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.313
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Nam Ly Hoang",
        "age": null,
        "rating": 6.196
      },
      {
        "rank": 2,
        "name": "Phuc Huynh",
        "age": null,
        "rating": 6.07
      },
      {
        "rank": 3,
        "name": "Truong Hien",
        "age": null,
        "rating": 6.05
      },
      {
        "rank": 4,
        "name": "Luc Pham",
        "age": null,
        "rating": 5.973
      },
      {
        "rank": 5,
        "name": "Wong Hong Kit",
        "age": null,
        "rating": 5.921
      },
      {
        "rank": 6,
        "name": "Quang Duong",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 7,
        "name": "Naveen Beasley",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 8,
        "name": "Dale Kim",
        "age": null,
        "rating": 5.892
      },
      {
        "rank": 9,
        "name": "Giang Trinh",
        "age": null,
        "rating": 5.687
      },
      {
        "rank": 10,
        "name": "NguyễN ĐắC TiếN",
        "age": null,
        "rating": 5.675
      },
      {
        "rank": 11,
        "name": "Nasa Hatakeyama",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 12,
        "name": "Sarinreach Leng",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 13,
        "name": "Kenta Miyoshi",
        "age": null,
        "rating": 5.627
      },
      {
        "rank": 14,
        "name": "Hoàng NguyễN ViệT",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 15,
        "name": "Jimmy Liong Kai Long",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 16,
        "name": "Mikar Fisher",
        "age": null,
        "rating": 5.595
      },
      {
        "rank": 17,
        "name": "Aditya Ruhela",
        "age": null,
        "rating": 5.571
      },
      {
        "rank": 18,
        "name": "Aryaan Bhatia",
        "age": null,
        "rating": 5.568
      },
      {
        "rank": 19,
        "name": "Rashein Samuel",
        "age": null,
        "rating": 5.53
      },
      {
        "rank": 20,
        "name": "Kento Tamaki",
        "age": null,
        "rating": 5.494
      },
      {
        "rank": 21,
        "name": "Vanshik Kapadia",
        "age": null,
        "rating": 5.493
      },
      {
        "rank": 22,
        "name": "Ram Kotnana",
        "age": null,
        "rating": 5.483
      },
      {
        "rank": 23,
        "name": "Hoai Anh Pham",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 24,
        "name": "TuấN Long PhạM",
        "age": null,
        "rating": 5.446
      },
      {
        "rank": 25,
        "name": "Timothy Foo Yi Thim",
        "age": null,
        "rating": 5.439
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Yufei Long",
        "age": null,
        "rating": 5.609
      },
      {
        "rank": 2,
        "name": "Chao Yi Wang",
        "age": null,
        "rating": 5.559
      },
      {
        "rank": 3,
        "name": "Trang Huynh",
        "age": null,
        "rating": 5.552
      },
      {
        "rank": 4,
        "name": "Yu-Chieh Hsieh",
        "age": null,
        "rating": 5.522
      },
      {
        "rank": 5,
        "name": "Kao Pei Chuan",
        "age": null,
        "rating": 5.508
      },
      {
        "rank": 6,
        "name": "Kelsey Laurente",
        "age": null,
        "rating": 5.499
      },
      {
        "rank": 7,
        "name": "Rika Fujiwara",
        "age": null,
        "rating": 5.455
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
        "rating": 5.296
      },
      {
        "rank": 10,
        "name": "Alicia Lai",
        "age": null,
        "rating": 5.278
      },
      {
        "rank": 11,
        "name": "Aaliya Ebrahim",
        "age": null,
        "rating": 5.271
      },
      {
        "rank": 12,
        "name": "Tang Nok Yiu",
        "age": null,
        "rating": 5.252
      },
      {
        "rank": 13,
        "name": "Sophia HuỳNh TrầN NgọC Nhi",
        "age": null,
        "rating": 5.243
      },
      {
        "rank": 14,
        "name": "Aiko Yoshitomi",
        "age": null,
        "rating": 5.227
      },
      {
        "rank": 15,
        "name": "Mihika Yadav",
        "age": null,
        "rating": 5.206
      },
      {
        "rank": 16,
        "name": "Albie Huang",
        "age": null,
        "rating": 5.205
      },
      {
        "rank": 17,
        "name": "Virvienica Bejosano",
        "age": null,
        "rating": 5.195
      },
      {
        "rank": 18,
        "name": "Mihae Kwon",
        "age": null,
        "rating": 5.113
      },
      {
        "rank": 19,
        "name": "Ying Suet Lam",
        "age": null,
        "rating": 5.11
      },
      {
        "rank": 20,
        "name": "Yunqi He",
        "age": null,
        "rating": 5.108
      },
      {
        "rank": 21,
        "name": "Anni Xie",
        "age": null,
        "rating": 5.1
      },
      {
        "rank": 22,
        "name": "Ting Chieh Wei",
        "age": null,
        "rating": 5.093
      },
      {
        "rank": 23,
        "name": "Khushi Desai",
        "age": null,
        "rating": 5.064
      },
      {
        "rank": 24,
        "name": "Huong Dan Linh",
        "age": null,
        "rating": 5.059
      },
      {
        "rank": 25,
        "name": "Lo Pay Jyue",
        "age": null,
        "rating": 5.037
      }
    ]
  },
  "north-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Jw Johnson",
        "age": null,
        "rating": 7.047
      },
      {
        "rank": 2,
        "name": "Ben Johns",
        "age": null,
        "rating": 7.032
      },
      {
        "rank": 3,
        "name": "Hayden Patriquin",
        "age": null,
        "rating": 6.888
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.827
      },
      {
        "rank": 5,
        "name": "Riley Newman",
        "age": null,
        "rating": 6.651
      },
      {
        "rank": 6,
        "name": "Cj Klinger",
        "age": null,
        "rating": 6.601
      },
      {
        "rank": 7,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.542
      },
      {
        "rank": 8,
        "name": "Dylan Frazier",
        "age": null,
        "rating": 6.458
      },
      {
        "rank": 9,
        "name": "Will Howells",
        "age": null,
        "rating": 6.448
      },
      {
        "rank": 10,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.428
      },
      {
        "rank": 11,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.331
      },
      {
        "rank": 12,
        "name": "John Goins",
        "age": null,
        "rating": 6.314
      },
      {
        "rank": 13,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.306
      },
      {
        "rank": 14,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.277
      },
      {
        "rank": 15,
        "name": "Richard Livornese Jr",
        "age": null,
        "rating": 6.273
      },
      {
        "rank": 16,
        "name": "Jack Munro",
        "age": null,
        "rating": 6.271
      },
      {
        "rank": 17,
        "name": "Blaine Hovenier",
        "age": null,
        "rating": 6.267
      },
      {
        "rank": 18,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.263
      },
      {
        "rank": 19,
        "name": "Travis Rettenmaier",
        "age": null,
        "rating": 6.248
      },
      {
        "rank": 20,
        "name": "Elliott Schupp",
        "age": null,
        "rating": 6.237
      },
      {
        "rank": 21,
        "name": "Zane Navratil",
        "age": null,
        "rating": 6.235
      },
      {
        "rank": 22,
        "name": "Michael Loyd",
        "age": null,
        "rating": 6.231
      },
      {
        "rank": 23,
        "name": "Maxwell Freeman",
        "age": null,
        "rating": 6.219
      },
      {
        "rank": 24,
        "name": "Wyatt Stone",
        "age": null,
        "rating": 6.211
      },
      {
        "rank": 25,
        "name": "Casey Diamond",
        "age": null,
        "rating": 6.21
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.999
      },
      {
        "rank": 2,
        "name": "Anna Bright",
        "age": null,
        "rating": 6.604
      },
      {
        "rank": 3,
        "name": "Hurricane Tyra Black",
        "age": null,
        "rating": 6.403
      },
      {
        "rank": 4,
        "name": "Jorja Johnson",
        "age": null,
        "rating": 6.322
      },
      {
        "rank": 5,
        "name": "Parris Todd",
        "age": null,
        "rating": 6.288
      },
      {
        "rank": 6,
        "name": "Rachel Rohrabacher",
        "age": null,
        "rating": 6.259
      },
      {
        "rank": 7,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.224
      },
      {
        "rank": 8,
        "name": "Jackie Kawamoto",
        "age": null,
        "rating": 6.189
      },
      {
        "rank": 9,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 6.174
      },
      {
        "rank": 10,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 6.155
      },
      {
        "rank": 11,
        "name": "Jade Kawamoto",
        "age": null,
        "rating": 6.138
      },
      {
        "rank": 12,
        "name": "Mariechristine Salvas",
        "age": null,
        "rating": 6.109
      },
      {
        "rank": 13,
        "name": "Meghan Dizon",
        "age": null,
        "rating": 6.03
      },
      {
        "rank": 14,
        "name": "Lacy Schneemann",
        "age": null,
        "rating": 6.021
      },
      {
        "rank": 15,
        "name": "Etta Tuionetoa",
        "age": null,
        "rating": 6.014
      },
      {
        "rank": 16,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 6.009
      },
      {
        "rank": 17,
        "name": "Audra Spielberger",
        "age": null,
        "rating": 6.002
      },
      {
        "rank": 18,
        "name": "Jillian Braverman",
        "age": null,
        "rating": 5.989
      },
      {
        "rank": 19,
        "name": "Vivian Glozman",
        "age": null,
        "rating": 5.951
      },
      {
        "rank": 20,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.926
      },
      {
        "rank": 21,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.898
      },
      {
        "rank": 22,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 23,
        "name": "Lauren Cole",
        "age": null,
        "rating": 5.875
      },
      {
        "rank": 24,
        "name": "Allison Harris",
        "age": null,
        "rating": 5.866
      },
      {
        "rank": 25,
        "name": "Christine Maddox",
        "age": null,
        "rating": 5.866
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Haworth",
        "age": null,
        "rating": 6.655
      },
      {
        "rank": 2,
        "name": "Hunter Johnson",
        "age": null,
        "rating": 6.637
      },
      {
        "rank": 3,
        "name": "John Goins",
        "age": null,
        "rating": 6.614
      },
      {
        "rank": 4,
        "name": "Christian Alshon",
        "age": null,
        "rating": 6.568
      },
      {
        "rank": 5,
        "name": "Roscoe Bellamy",
        "age": null,
        "rating": 6.464
      },
      {
        "rank": 6,
        "name": "Ben Johns",
        "age": null,
        "rating": 6.437
      },
      {
        "rank": 7,
        "name": "Jack Sock",
        "age": null,
        "rating": 6.356
      },
      {
        "rank": 8,
        "name": "Tama Shimabukuro",
        "age": null,
        "rating": 6.319
      },
      {
        "rank": 9,
        "name": "Gabriel Joseph",
        "age": null,
        "rating": 6.299
      },
      {
        "rank": 10,
        "name": "Ammar Wazir",
        "age": null,
        "rating": 6.284
      },
      {
        "rank": 11,
        "name": "Adam Harvey",
        "age": null,
        "rating": 6.257
      },
      {
        "rank": 12,
        "name": "Yates Johnson",
        "age": null,
        "rating": 6.249
      },
      {
        "rank": 13,
        "name": "Jw Johnson",
        "age": null,
        "rating": 6.217
      },
      {
        "rank": 14,
        "name": "Zane Ford",
        "age": null,
        "rating": 6.215
      },
      {
        "rank": 15,
        "name": "Camden Chaffin",
        "age": null,
        "rating": 6.198
      },
      {
        "rank": 16,
        "name": "Matthew Barlow",
        "age": null,
        "rating": 6.177
      },
      {
        "rank": 17,
        "name": "Connor Garnett",
        "age": null,
        "rating": 6.165
      },
      {
        "rank": 18,
        "name": "Cason Campbell",
        "age": null,
        "rating": 6.152
      },
      {
        "rank": 19,
        "name": "Connor Mogle",
        "age": null,
        "rating": 6.102
      },
      {
        "rank": 20,
        "name": "Tyson Mcguffin",
        "age": null,
        "rating": 6.097
      },
      {
        "rank": 21,
        "name": "Donald Young",
        "age": null,
        "rating": 6.096
      },
      {
        "rank": 22,
        "name": "Grayson Goldin",
        "age": null,
        "rating": 6.092
      },
      {
        "rank": 23,
        "name": "Dusty Boyer",
        "age": null,
        "rating": 6.084
      },
      {
        "rank": 24,
        "name": "Augustus Ge",
        "age": null,
        "rating": 6.075
      },
      {
        "rank": 25,
        "name": "Youssef Bouzidi",
        "age": null,
        "rating": 6.07
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Anna Leigh Waters",
        "age": null,
        "rating": 6.704
      },
      {
        "rank": 2,
        "name": "Kate Fahey",
        "age": null,
        "rating": 6.257
      },
      {
        "rank": 3,
        "name": "Katerina Stewart",
        "age": null,
        "rating": 5.974
      },
      {
        "rank": 4,
        "name": "Kaitlyn Christian",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 5,
        "name": "Sofia Sewing",
        "age": null,
        "rating": 5.885
      },
      {
        "rank": 6,
        "name": "Brooke Buckner",
        "age": null,
        "rating": 5.827
      },
      {
        "rank": 7,
        "name": "Judit Castillo Gargallo",
        "age": null,
        "rating": 5.793
      },
      {
        "rank": 8,
        "name": "Catherine Parenteau",
        "age": null,
        "rating": 5.784
      },
      {
        "rank": 9,
        "name": "Lea Jansen",
        "age": null,
        "rating": 5.755
      },
      {
        "rank": 10,
        "name": "Kiora Kunimoto",
        "age": null,
        "rating": 5.732
      },
      {
        "rank": 11,
        "name": "Bobbi Oshiro",
        "age": null,
        "rating": 5.669
      },
      {
        "rank": 12,
        "name": "Keilly Ulery",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 13,
        "name": "Isabella Dunlap",
        "age": null,
        "rating": 5.624
      },
      {
        "rank": 14,
        "name": "Maria Vyshkina",
        "age": null,
        "rating": 5.559
      },
      {
        "rank": 15,
        "name": "Amber Policare",
        "age": null,
        "rating": 5.553
      },
      {
        "rank": 16,
        "name": "Genie Bouchard",
        "age": null,
        "rating": 5.541
      },
      {
        "rank": 17,
        "name": "Jessica Ho",
        "age": null,
        "rating": 5.533
      },
      {
        "rank": 18,
        "name": "Cailyn Campbell",
        "age": null,
        "rating": 5.523
      },
      {
        "rank": 19,
        "name": "Liz Truluck",
        "age": null,
        "rating": 5.502
      },
      {
        "rank": 20,
        "name": "Milan Rane",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 21,
        "name": "Jessica Evanier",
        "age": null,
        "rating": 5.461
      },
      {
        "rank": 22,
        "name": "Karin Ptaszek-Kochis",
        "age": null,
        "rating": 5.457
      },
      {
        "rank": 23,
        "name": "Jada Bui",
        "age": null,
        "rating": 5.452
      },
      {
        "rank": 24,
        "name": "Jalina Ingram",
        "age": null,
        "rating": 5.41
      },
      {
        "rank": 25,
        "name": "Eileen Wang",
        "age": null,
        "rating": 5.376
      }
    ]
  },
  "south-america": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Gabriel Tardio",
        "age": null,
        "rating": 6.795
      },
      {
        "rank": 2,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.714
      },
      {
        "rank": 3,
        "name": "Nicolas Acevedo",
        "age": null,
        "rating": 6.663
      },
      {
        "rank": 4,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.653
      },
      {
        "rank": 5,
        "name": "Pablo Tellez",
        "age": null,
        "rating": 6.332
      },
      {
        "rank": 6,
        "name": "Bruno Faletto",
        "age": null,
        "rating": 6.231
      },
      {
        "rank": 7,
        "name": "Jaime Oncins",
        "age": null,
        "rating": 6.127
      },
      {
        "rank": 8,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.114
      },
      {
        "rank": 9,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.015
      },
      {
        "rank": 10,
        "name": "James Delgado",
        "age": null,
        "rating": 5.996
      },
      {
        "rank": 11,
        "name": "Juan Varon",
        "age": null,
        "rating": 5.952
      },
      {
        "rank": 12,
        "name": "Carlos Di Laura",
        "age": null,
        "rating": 5.781
      },
      {
        "rank": 13,
        "name": "Mario Barrientos",
        "age": null,
        "rating": 5.763
      },
      {
        "rank": 14,
        "name": "Patricio Pereyra",
        "age": null,
        "rating": 5.749
      },
      {
        "rank": 15,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.647
      },
      {
        "rank": 16,
        "name": "Kevin Dayan",
        "age": null,
        "rating": 5.636
      },
      {
        "rank": 17,
        "name": "Andrew Angulo",
        "age": null,
        "rating": 5.549
      },
      {
        "rank": 18,
        "name": "Miguel Alda",
        "age": null,
        "rating": 5.524
      },
      {
        "rank": 19,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.507
      },
      {
        "rank": 20,
        "name": "Tobias Golberg",
        "age": null,
        "rating": 5.457
      },
      {
        "rank": 21,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.434
      },
      {
        "rank": 22,
        "name": "Juan Medina",
        "age": null,
        "rating": 5.417
      },
      {
        "rank": 23,
        "name": "Federico Nani",
        "age": null,
        "rating": 5.414
      },
      {
        "rank": 24,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.395
      },
      {
        "rank": 25,
        "name": "Carlos Subero",
        "age": null,
        "rating": 5.389
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 6.065
      },
      {
        "rank": 2,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 6.048
      },
      {
        "rank": 3,
        "name": "Lucia White",
        "age": null,
        "rating": 5.651
      },
      {
        "rank": 4,
        "name": "Pierina Imparato",
        "age": null,
        "rating": 5.424
      },
      {
        "rank": 5,
        "name": "Alexa Quintanilla",
        "age": null,
        "rating": 5.42
      },
      {
        "rank": 6,
        "name": "Gabriela Katz",
        "age": null,
        "rating": 5.404
      },
      {
        "rank": 7,
        "name": "Namie Isago",
        "age": null,
        "rating": 5.349
      },
      {
        "rank": 8,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 5.305
      },
      {
        "rank": 9,
        "name": "Carolina Mayorga Perry",
        "age": null,
        "rating": 5.211
      },
      {
        "rank": 10,
        "name": "Nicole Lange Beidacki",
        "age": null,
        "rating": 5.162
      },
      {
        "rank": 11,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.077
      },
      {
        "rank": 12,
        "name": "Bequi Barros Behar Luizelli",
        "age": null,
        "rating": 5.055
      },
      {
        "rank": 13,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 5.026
      },
      {
        "rank": 14,
        "name": "Dayana Fahey",
        "age": null,
        "rating": 5.025
      },
      {
        "rank": 15,
        "name": "Tatiana Ruhl",
        "age": null,
        "rating": 5.011
      },
      {
        "rank": 16,
        "name": "Ali Quintero",
        "age": null,
        "rating": 5.004
      },
      {
        "rank": 17,
        "name": "Isabella Ochoa",
        "age": null,
        "rating": 4.997
      },
      {
        "rank": 18,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.994
      },
      {
        "rank": 19,
        "name": "Eliza De Oliveira Rocha",
        "age": null,
        "rating": 4.927
      },
      {
        "rank": 20,
        "name": "Patricia Medrado",
        "age": null,
        "rating": 4.898
      },
      {
        "rank": 21,
        "name": "Lina Romero Alarcon",
        "age": null,
        "rating": 4.787
      },
      {
        "rank": 22,
        "name": "Arianna Raga",
        "age": null,
        "rating": 4.778
      },
      {
        "rank": 23,
        "name": "Mariana Paredes",
        "age": null,
        "rating": 4.746
      },
      {
        "rank": 24,
        "name": "Marcelle Prates",
        "age": null,
        "rating": 4.724
      },
      {
        "rank": 25,
        "name": "Isadora Campi",
        "age": null,
        "rating": 4.677
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Federico Staksrud",
        "age": null,
        "rating": 6.621
      },
      {
        "rank": 2,
        "name": "Rafael Lenhard",
        "age": null,
        "rating": 6.337
      },
      {
        "rank": 3,
        "name": "Eric Oncins",
        "age": null,
        "rating": 6.241
      },
      {
        "rank": 4,
        "name": "Andre Millet",
        "age": null,
        "rating": 6.088
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
        "rating": 5.565
      },
      {
        "rank": 7,
        "name": "Nicolas Almeida",
        "age": null,
        "rating": 5.498
      },
      {
        "rank": 8,
        "name": "Hugo Dojas",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 9,
        "name": "Mario Porcelli",
        "age": null,
        "rating": 5.438
      },
      {
        "rank": 10,
        "name": "Michael Vallejo",
        "age": null,
        "rating": 5.382
      },
      {
        "rank": 11,
        "name": "Lucas Coutinho",
        "age": null,
        "rating": 5.37
      },
      {
        "rank": 12,
        "name": "Kym Sze",
        "age": null,
        "rating": 5.265
      },
      {
        "rank": 13,
        "name": "Rodrigo Borrero",
        "age": null,
        "rating": 5.25
      },
      {
        "rank": 14,
        "name": "Caio Silva",
        "age": null,
        "rating": 5.194
      },
      {
        "rank": 15,
        "name": "Fernando Zurita",
        "age": null,
        "rating": 5.194
      },
      {
        "rank": 16,
        "name": "Juan Pablo Pinilla",
        "age": null,
        "rating": 5.18
      },
      {
        "rank": 17,
        "name": "Diego Gonzales",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 18,
        "name": "Cristobal Del Castillo",
        "age": null,
        "rating": 5.15
      },
      {
        "rank": 19,
        "name": "Ayke Rodrigues",
        "age": null,
        "rating": 5.147
      },
      {
        "rank": 20,
        "name": "Lucas Severo",
        "age": null,
        "rating": 5.138
      },
      {
        "rank": 21,
        "name": "Nicolas Yannuzzi",
        "age": null,
        "rating": 5.125
      },
      {
        "rank": 22,
        "name": "Gabriel Weffort Hilbert",
        "age": null,
        "rating": 5.12
      },
      {
        "rank": 23,
        "name": "Thiago Soto",
        "age": null,
        "rating": 5.114
      },
      {
        "rank": 24,
        "name": "Tommy Calle",
        "age": null,
        "rating": 5.113
      },
      {
        "rank": 25,
        "name": "João Pedro Agulha Fernandes",
        "age": null,
        "rating": 5.109
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Eugenia Carolina Lopez Ascarate",
        "age": null,
        "rating": 5.411
      },
      {
        "rank": 2,
        "name": "Mariana Humberg",
        "age": null,
        "rating": 5.378
      },
      {
        "rank": 3,
        "name": "Raquel Amaro Veloso",
        "age": null,
        "rating": 5.161
      },
      {
        "rank": 4,
        "name": "Ana Bergantini Burjaili",
        "age": null,
        "rating": 4.916
      },
      {
        "rank": 5,
        "name": "Sofia Kelbert",
        "age": null,
        "rating": 4.793
      },
      {
        "rank": 6,
        "name": "Eliza De Oliveira Rocha",
        "age": null,
        "rating": 4.768
      },
      {
        "rank": 7,
        "name": "Camila Militao",
        "age": null,
        "rating": 4.751
      },
      {
        "rank": 8,
        "name": "Marcela Donatoni",
        "age": null,
        "rating": 4.739
      },
      {
        "rank": 9,
        "name": "Isadora Campi",
        "age": null,
        "rating": 4.734
      },
      {
        "rank": 10,
        "name": "Katherine Vanessa Serrano Lopez",
        "age": null,
        "rating": 4.674
      },
      {
        "rank": 11,
        "name": "Genesis Pinto",
        "age": null,
        "rating": 4.626
      },
      {
        "rank": 12,
        "name": "Ana Sánchez",
        "age": null,
        "rating": 4.598
      },
      {
        "rank": 13,
        "name": "Giovanna Mandon Grigioni",
        "age": null,
        "rating": 4.521
      },
      {
        "rank": 14,
        "name": "Sofia Daniela Rodriguez Camejo",
        "age": null,
        "rating": 4.478
      },
      {
        "rank": 15,
        "name": "Míria Nascimento",
        "age": null,
        "rating": 4.446
      },
      {
        "rank": 16,
        "name": "Mia Alva",
        "age": null,
        "rating": 4.381
      },
      {
        "rank": 17,
        "name": "Delfina Debenedetti",
        "age": null,
        "rating": 4.336
      },
      {
        "rank": 18,
        "name": "Rihanna Beyloune",
        "age": null,
        "rating": 4.308
      },
      {
        "rank": 19,
        "name": "Luana Ferreira",
        "age": null,
        "rating": 4.296
      },
      {
        "rank": 20,
        "name": "Belen Salvatierra",
        "age": null,
        "rating": 4.29
      },
      {
        "rank": 21,
        "name": "Cristina Verta",
        "age": null,
        "rating": 4.268
      },
      {
        "rank": 22,
        "name": "Carolina Ledesma",
        "age": null,
        "rating": 4.253
      },
      {
        "rank": 23,
        "name": "Ana Julia Menon Bosso",
        "age": null,
        "rating": 4.202
      },
      {
        "rank": 24,
        "name": "Sofia Torres",
        "age": null,
        "rating": 4.185
      },
      {
        "rank": 25,
        "name": "Valeria Mayta",
        "age": null,
        "rating": 4.162
      }
    ]
  },
  "australia-oceania": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "George Wall",
        "age": null,
        "rating": 5.97
      },
      {
        "rank": 2,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.941
      },
      {
        "rank": 3,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.9
      },
      {
        "rank": 4,
        "name": "Ryan Henry",
        "age": null,
        "rating": 5.721
      },
      {
        "rank": 5,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.696
      },
      {
        "rank": 6,
        "name": "Andre Mick",
        "age": null,
        "rating": 5.695
      },
      {
        "rank": 7,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.662
      },
      {
        "rank": 8,
        "name": "Harrison Brown",
        "age": null,
        "rating": 5.65
      },
      {
        "rank": 9,
        "name": "Morgan Evans",
        "age": null,
        "rating": 5.594
      },
      {
        "rank": 10,
        "name": "Robert Claveria Stirling",
        "age": null,
        "rating": 5.587
      },
      {
        "rank": 11,
        "name": "Tristan Stayt",
        "age": null,
        "rating": 5.488
      },
      {
        "rank": 12,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.467
      },
      {
        "rank": 13,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.463
      },
      {
        "rank": 14,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.421
      },
      {
        "rank": 15,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.374
      },
      {
        "rank": 16,
        "name": "Ethan Butson",
        "age": null,
        "rating": 5.346
      },
      {
        "rank": 17,
        "name": "Ciaran Lavers",
        "age": null,
        "rating": 5.311
      },
      {
        "rank": 18,
        "name": "Ben Dawson",
        "age": null,
        "rating": 5.295
      },
      {
        "rank": 19,
        "name": "Conor Robertshawe",
        "age": null,
        "rating": 5.294
      },
      {
        "rank": 20,
        "name": "Joshua Nipperess",
        "age": null,
        "rating": 5.274
      },
      {
        "rank": 21,
        "name": "Chris Turvey",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 22,
        "name": "Jason William Taylor",
        "age": null,
        "rating": 5.249
      },
      {
        "rank": 23,
        "name": "Andrew Kratzmann",
        "age": null,
        "rating": 5.245
      },
      {
        "rank": 24,
        "name": "Andrew Horridge",
        "age": null,
        "rating": 5.232
      },
      {
        "rank": 25,
        "name": "Ryan Morris",
        "age": null,
        "rating": 5.22
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 6.0
      },
      {
        "rank": 2,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.908
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.876
      },
      {
        "rank": 4,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 5,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.728
      },
      {
        "rank": 6,
        "name": "Kelsey Grambeau",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 7,
        "name": "Somer Dallabona",
        "age": null,
        "rating": 5.663
      },
      {
        "rank": 8,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.616
      },
      {
        "rank": 9,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.547
      },
      {
        "rank": 10,
        "name": "Talia Saunders",
        "age": null,
        "rating": 5.544
      },
      {
        "rank": 11,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 5.337
      },
      {
        "rank": 12,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.29
      },
      {
        "rank": 13,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.279
      },
      {
        "rank": 14,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.276
      },
      {
        "rank": 15,
        "name": "Katherine Westbury",
        "age": null,
        "rating": 5.266
      },
      {
        "rank": 16,
        "name": "Sarah Burr",
        "age": null,
        "rating": 5.257
      },
      {
        "rank": 17,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.157
      },
      {
        "rank": 18,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 5.145
      },
      {
        "rank": 19,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.093
      },
      {
        "rank": 20,
        "name": "Karen Denman",
        "age": null,
        "rating": 5.039
      },
      {
        "rank": 21,
        "name": "Tyra Calderwood",
        "age": null,
        "rating": 5.027
      },
      {
        "rank": 22,
        "name": "Shannon Spencer",
        "age": null,
        "rating": 5.007
      },
      {
        "rank": 23,
        "name": "Belinda Crane",
        "age": null,
        "rating": 5.006
      },
      {
        "rank": 24,
        "name": "Nancy Ferguson",
        "age": null,
        "rating": 4.956
      },
      {
        "rank": 25,
        "name": "Aleisha Horridge",
        "age": null,
        "rating": 4.907
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Christopher Crouch",
        "age": null,
        "rating": 5.967
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
        "rating": 5.646
      },
      {
        "rank": 4,
        "name": "Mitchell Hargreaves",
        "age": null,
        "rating": 5.509
      },
      {
        "rank": 5,
        "name": "Sahil Dang",
        "age": null,
        "rating": 5.483
      },
      {
        "rank": 6,
        "name": "Andy Van Der Vyver",
        "age": null,
        "rating": 5.472
      },
      {
        "rank": 7,
        "name": "Joseph Wild",
        "age": null,
        "rating": 5.448
      },
      {
        "rank": 8,
        "name": "Brian Tran",
        "age": null,
        "rating": 5.424
      },
      {
        "rank": 9,
        "name": "Zachary Grabovic",
        "age": null,
        "rating": 5.394
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
        "name": "Ryan Lee",
        "age": null,
        "rating": 5.308
      },
      {
        "rank": 13,
        "name": "Ethan Chung",
        "age": null,
        "rating": 5.27
      },
      {
        "rank": 14,
        "name": "Michael Massih",
        "age": null,
        "rating": 5.264
      },
      {
        "rank": 15,
        "name": "Kyle Stoker",
        "age": null,
        "rating": 5.259
      },
      {
        "rank": 16,
        "name": "Daiki Tanabe",
        "age": null,
        "rating": 5.241
      },
      {
        "rank": 17,
        "name": "Kyron Pinter",
        "age": null,
        "rating": 5.211
      },
      {
        "rank": 18,
        "name": "Liam Lamb",
        "age": null,
        "rating": 5.191
      },
      {
        "rank": 19,
        "name": "James Wilson",
        "age": null,
        "rating": 5.156
      },
      {
        "rank": 20,
        "name": "Lucas Pascoe",
        "age": null,
        "rating": 5.155
      },
      {
        "rank": 21,
        "name": "Joshua Barber",
        "age": null,
        "rating": 5.147
      },
      {
        "rank": 22,
        "name": "Feiloakitohi Tavalea",
        "age": null,
        "rating": 5.102
      },
      {
        "rank": 23,
        "name": "Nicholas Maleganeas",
        "age": null,
        "rating": 5.086
      },
      {
        "rank": 24,
        "name": "Jason William Taylor",
        "age": null,
        "rating": 5.069
      },
      {
        "rank": 25,
        "name": "Ryan Morris",
        "age": null,
        "rating": 5.064
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Andie Dikosavljevic",
        "age": null,
        "rating": 5.949
      },
      {
        "rank": 2,
        "name": "Seone Mendez",
        "age": null,
        "rating": 5.887
      },
      {
        "rank": 3,
        "name": "Sahra Dennehy",
        "age": null,
        "rating": 5.702
      },
      {
        "rank": 4,
        "name": "Selina Turulja",
        "age": null,
        "rating": 5.435
      },
      {
        "rank": 5,
        "name": "Michaela Haet",
        "age": null,
        "rating": 5.389
      },
      {
        "rank": 6,
        "name": "Ela I Puleni Vakaukamea",
        "age": null,
        "rating": 5.362
      },
      {
        "rank": 7,
        "name": "Emilia Schmidt",
        "age": null,
        "rating": 5.304
      },
      {
        "rank": 8,
        "name": "Nicola Schoeman",
        "age": null,
        "rating": 5.251
      },
      {
        "rank": 9,
        "name": "Danni-Elle Townsend",
        "age": null,
        "rating": 5.25
      },
      {
        "rank": 10,
        "name": "Bernadette Massih",
        "age": null,
        "rating": 5.161
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
        "name": "Jasmine Almaguer",
        "age": null,
        "rating": 5.096
      },
      {
        "rank": 14,
        "name": "Katerina Valos",
        "age": null,
        "rating": 5.054
      },
      {
        "rank": 15,
        "name": "Brittany Yang",
        "age": null,
        "rating": 5.01
      },
      {
        "rank": 16,
        "name": "Kaitlynn Hart",
        "age": null,
        "rating": 4.987
      },
      {
        "rank": 17,
        "name": "Nives Baric",
        "age": null,
        "rating": 4.961
      },
      {
        "rank": 18,
        "name": "Simone Kessell",
        "age": null,
        "rating": 4.899
      },
      {
        "rank": 19,
        "name": "Aria Henare",
        "age": null,
        "rating": 4.881
      },
      {
        "rank": 20,
        "name": "Karen Denman",
        "age": null,
        "rating": 4.875
      },
      {
        "rank": 21,
        "name": "Ange Green",
        "age": null,
        "rating": 4.866
      },
      {
        "rank": 22,
        "name": "Mandy Corbett",
        "age": null,
        "rating": 4.825
      },
      {
        "rank": 23,
        "name": "Ayesha Dang",
        "age": null,
        "rating": 4.822
      },
      {
        "rank": 24,
        "name": "Tayah Cross",
        "age": null,
        "rating": 4.786
      },
      {
        "rank": 25,
        "name": "Louise Oxnevad",
        "age": null,
        "rating": 4.731
      }
    ]
  },
  "europe": {
    "mens-doubles": [
      {
        "rank": 1,
        "name": "Andrei Daescu",
        "age": null,
        "rating": 6.844
      },
      {
        "rank": 2,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 6.483
      },
      {
        "rank": 3,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.463
      },
      {
        "rank": 4,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.454
      },
      {
        "rank": 5,
        "name": "Dekel Bar",
        "age": null,
        "rating": 6.444
      },
      {
        "rank": 6,
        "name": "Martin Emmrich",
        "age": null,
        "rating": 6.2
      },
      {
        "rank": 7,
        "name": "Dj Young",
        "age": null,
        "rating": 6.123
      },
      {
        "rank": 8,
        "name": "Luca Mack",
        "age": null,
        "rating": 6.119
      },
      {
        "rank": 9,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 6.104
      },
      {
        "rank": 10,
        "name": "Oscar Serra",
        "age": null,
        "rating": 6.049
      },
      {
        "rank": 11,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 6.035
      },
      {
        "rank": 12,
        "name": "Tom Protzek",
        "age": null,
        "rating": 6.015
      },
      {
        "rank": 13,
        "name": "Patrick Smith",
        "age": null,
        "rating": 5.953
      },
      {
        "rank": 14,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.933
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
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.851
      },
      {
        "rank": 18,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.824
      },
      {
        "rank": 19,
        "name": "Jhonnatan Medina Alvarez",
        "age": null,
        "rating": 5.814
      },
      {
        "rank": 20,
        "name": "Alvaro Regalado",
        "age": null,
        "rating": 5.795
      },
      {
        "rank": 21,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.776
      },
      {
        "rank": 22,
        "name": "Louis Laville",
        "age": null,
        "rating": 5.754
      },
      {
        "rank": 23,
        "name": "Josep Canyadell",
        "age": null,
        "rating": 5.747
      },
      {
        "rank": 24,
        "name": "Domenico Geminiani",
        "age": null,
        "rating": 5.732
      },
      {
        "rank": 25,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.719
      }
    ],
    "womens-doubles": [
      {
        "rank": 1,
        "name": "Tina Pisnik",
        "age": null,
        "rating": 6.175
      },
      {
        "rank": 2,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 6.111
      },
      {
        "rank": 3,
        "name": "Megan Fudge",
        "age": null,
        "rating": 5.967
      },
      {
        "rank": 4,
        "name": "Ewa Radzikowska",
        "age": null,
        "rating": 5.896
      },
      {
        "rank": 5,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.853
      },
      {
        "rank": 6,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.761
      },
      {
        "rank": 7,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.752
      },
      {
        "rank": 8,
        "name": "Daria Walczak",
        "age": null,
        "rating": 5.717
      },
      {
        "rank": 9,
        "name": "Paula Rives Palau",
        "age": null,
        "rating": 5.71
      },
      {
        "rank": 10,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.689
      },
      {
        "rank": 11,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.616
      },
      {
        "rank": 12,
        "name": "Lucy Kovalova",
        "age": null,
        "rating": 5.603
      },
      {
        "rank": 13,
        "name": "Andrea Olson",
        "age": null,
        "rating": 5.598
      },
      {
        "rank": 14,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.596
      },
      {
        "rank": 15,
        "name": "Yana Newell",
        "age": null,
        "rating": 5.572
      },
      {
        "rank": 16,
        "name": "Martina Frantova",
        "age": null,
        "rating": 5.568
      },
      {
        "rank": 17,
        "name": "Karolina Owczarek",
        "age": null,
        "rating": 5.561
      },
      {
        "rank": 18,
        "name": "Molly Odonoghue",
        "age": null,
        "rating": 5.517
      },
      {
        "rank": 19,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.498
      },
      {
        "rank": 20,
        "name": "Glauka Carvajal Lane",
        "age": null,
        "rating": 5.49
      },
      {
        "rank": 21,
        "name": "Maria Klokotzky",
        "age": null,
        "rating": 5.479
      },
      {
        "rank": 22,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.433
      },
      {
        "rank": 23,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.432
      },
      {
        "rank": 24,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 5.423
      },
      {
        "rank": 25,
        "name": "Tea Pejic",
        "age": null,
        "rating": 5.413
      }
    ],
    "mens-singles": [
      {
        "rank": 1,
        "name": "Jaume Martinez Vich",
        "age": null,
        "rating": 6.468
      },
      {
        "rank": 2,
        "name": "Noe Khlif",
        "age": null,
        "rating": 6.436
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
        "rating": 6.027
      },
      {
        "rank": 6,
        "name": "Jay Devilliers",
        "age": null,
        "rating": 5.971
      },
      {
        "rank": 7,
        "name": "Emilien Burnel",
        "age": null,
        "rating": 5.928
      },
      {
        "rank": 8,
        "name": "Martin Stanchev",
        "age": null,
        "rating": 5.925
      },
      {
        "rank": 9,
        "name": "Matthew Finnerty",
        "age": null,
        "rating": 5.92
      },
      {
        "rank": 10,
        "name": "Bako Balint Gergo",
        "age": null,
        "rating": 5.915
      },
      {
        "rank": 11,
        "name": "Oliver Frank",
        "age": null,
        "rating": 5.89
      },
      {
        "rank": 12,
        "name": "Ivan Jakovljevic",
        "age": null,
        "rating": 5.824
      },
      {
        "rank": 13,
        "name": "Patrick Kawka",
        "age": null,
        "rating": 5.796
      },
      {
        "rank": 14,
        "name": "Freddie Powell",
        "age": null,
        "rating": 5.74
      },
      {
        "rank": 15,
        "name": "Claudio Quinones Garcia",
        "age": null,
        "rating": 5.732
      },
      {
        "rank": 16,
        "name": "Mateusz Matysik",
        "age": null,
        "rating": 5.715
      },
      {
        "rank": 17,
        "name": "James Chaudry",
        "age": null,
        "rating": 5.695
      },
      {
        "rank": 18,
        "name": "Ignasi De Rueda",
        "age": null,
        "rating": 5.673
      },
      {
        "rank": 19,
        "name": "Ben Cawston",
        "age": null,
        "rating": 5.671
      },
      {
        "rank": 20,
        "name": "Marcello Paiva Jardim",
        "age": null,
        "rating": 5.66
      },
      {
        "rank": 21,
        "name": "Vasyl Yazadzhiev",
        "age": null,
        "rating": 5.64
      },
      {
        "rank": 22,
        "name": "Mikołaj Biedermann",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 23,
        "name": "Bartosz Karbownik",
        "age": null,
        "rating": 5.599
      },
      {
        "rank": 24,
        "name": "Mauro Garcia Sanchez",
        "age": null,
        "rating": 5.597
      },
      {
        "rank": 25,
        "name": "James Ling",
        "age": null,
        "rating": 5.545
      }
    ],
    "womens-singles": [
      {
        "rank": 1,
        "name": "Domenika Turkovic",
        "age": null,
        "rating": 5.77
      },
      {
        "rank": 2,
        "name": "Marianna Petrei",
        "age": null,
        "rating": 5.709
      },
      {
        "rank": 3,
        "name": "Helena Jansen",
        "age": null,
        "rating": 5.66
      },
      {
        "rank": 4,
        "name": "Roos Van Reek",
        "age": null,
        "rating": 5.639
      },
      {
        "rank": 5,
        "name": "Lina Padegimaite",
        "age": null,
        "rating": 5.525
      },
      {
        "rank": 6,
        "name": "Samantha Buyckx",
        "age": null,
        "rating": 5.44
      },
      {
        "rank": 7,
        "name": "Sabrina Mendez Dominguez",
        "age": null,
        "rating": 5.373
      },
      {
        "rank": 8,
        "name": "Estee Widdershoven",
        "age": null,
        "rating": 5.352
      },
      {
        "rank": 9,
        "name": "Caroline Nothnagel",
        "age": null,
        "rating": 5.295
      },
      {
        "rank": 10,
        "name": "Masa Grgan",
        "age": null,
        "rating": 5.268
      },
      {
        "rank": 11,
        "name": "Francesca Rumi",
        "age": null,
        "rating": 5.237
      },
      {
        "rank": 12,
        "name": "Katie Morris",
        "age": null,
        "rating": 5.23
      },
      {
        "rank": 13,
        "name": "Emma Van Hee",
        "age": null,
        "rating": 5.215
      },
      {
        "rank": 14,
        "name": "Naomi De Hart",
        "age": null,
        "rating": 5.191
      },
      {
        "rank": 15,
        "name": "Thaddea Lock",
        "age": null,
        "rating": 5.172
      },
      {
        "rank": 16,
        "name": "Pialena Ander",
        "age": null,
        "rating": 5.163
      },
      {
        "rank": 17,
        "name": "Emilia Richter",
        "age": null,
        "rating": 5.141
      },
      {
        "rank": 18,
        "name": "Maria Fernandez Costantino",
        "age": null,
        "rating": 5.076
      },
      {
        "rank": 19,
        "name": "Madalina Grigoriu",
        "age": null,
        "rating": 5.066
      },
      {
        "rank": 20,
        "name": "Myriam Enmer",
        "age": null,
        "rating": 5.053
      },
      {
        "rank": 21,
        "name": "Klara Thell Lenntorp",
        "age": null,
        "rating": 4.995
      },
      {
        "rank": 22,
        "name": "Frida Mudsam",
        "age": null,
        "rating": 4.988
      },
      {
        "rank": 23,
        "name": "Claudia Caymel",
        "age": null,
        "rating": 4.954
      },
      {
        "rank": 24,
        "name": "Marina Alcaide",
        "age": null,
        "rating": 4.946
      },
      {
        "rank": 25,
        "name": "Paola Tampieri",
        "age": null,
        "rating": 4.929
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

export const DUPR_LAST_UPDATED = "2026-11-02";
