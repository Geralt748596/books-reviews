import "dotenv/config";
import prisma from "../lib/db";

const SEED_USER_ID = "seed_user_witcher_books";
const SEED_USER_EMAIL = "seed.witcher@books-reviews.local";

const WITCHER_SERIES_NAME = "The Witcher";

const WITCHER_BOOKS = [
  {
    id: "seed_book_last_wish",
    title: "The Last Wish",
    authors: "Andrzej Sapkowski",
    description:
      "The Witcher: short stories introducing Geralt of Rivia — monsters, destiny, and the sorceress Yennefer.",
    language: "en",
    publishedDate: "2007",
    thumbnailUrl:
      "https://books.google.com/books/content?id=kXlsKgAACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
  },
  {
    id: "seed_book_sword_of_destiny",
    title: "Sword of Destiny",
    authors: "Andrzej Sapkowski",
    description:
      "Second Witcher short-story collection: Geralt meets destiny on the Brokilon and beyond.",
    language: "en",
    publishedDate: "2015",
    thumbnailUrl:
      "https://books.google.com/books/content?id=wtX4zgEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
  },
] as const;

type CharacterSeed = {
  name: string;
  /** All books this character appears in. */
  bookIds: (typeof WITCHER_BOOKS)[number]["id"][];
  descriptions: {
    bookId: (typeof WITCHER_BOOKS)[number]["id"];
    description: string;
  }[];
};

const WITCHER_CHARACTERS: CharacterSeed[] = [
  {
    name: "Geralt of Rivia",
    bookIds: ["seed_book_last_wish", "seed_book_sword_of_destiny"],
    descriptions: [
      {
        bookId: "seed_book_last_wish",
        description:
          "Witcher, monster hunter for hire; silver sword for beasts, steel for men.",
      },
      {
        bookId: "seed_book_sword_of_destiny",
        description: "Returns to Brokilon and deeper ties with Ciri's fate.",
      },
    ],
  },
  {
    name: "Dandelion (Jaskier)",
    bookIds: ["seed_book_last_wish", "seed_book_sword_of_destiny"],
    descriptions: [
      {
        bookId: "seed_book_last_wish",
        description: "Poet and bard; Geralt's friend and traveling companion.",
      },
      {
        bookId: "seed_book_sword_of_destiny",
        description: "Still narrating (and surviving) Geralt's adventures.",
      },
    ],
  },
  {
    name: "Yennefer of Vengerberg",
    bookIds: ["seed_book_last_wish"],
    descriptions: [
      {
        bookId: "seed_book_last_wish",
        description:
          "Powerful sorceress from Vengerberg; tied to Geralt by the djinn's wish.",
      },
    ],
  },
  {
    name: "Queen Calanthe",
    bookIds: ["seed_book_last_wish"],
    descriptions: [
      {
        bookId: "seed_book_last_wish",
        description: "Lioness of Cintra; fierce ruler and Ciri's grandmother.",
      },
    ],
  },
  {
    name: "Renfri of Creyden",
    bookIds: ["seed_book_last_wish"],
    descriptions: [
      {
        bookId: "seed_book_last_wish",
        description:
          "Princess turned bandit leader; Geralt faces her in Blaviken.",
      },
    ],
  },
  {
    name: "Cirilla Fiona Elen Riannon (Ciri)",
    bookIds: ["seed_book_sword_of_destiny"],
    descriptions: [
      {
        bookId: "seed_book_sword_of_destiny",
        description:
          "Princess of Cintra; her path crosses Geralt's in the dryads' forest.",
      },
    ],
  },
  {
    name: "Eithné",
    bookIds: ["seed_book_sword_of_destiny"],
    descriptions: [
      {
        bookId: "seed_book_sword_of_destiny",
        description: "Queen of the dryads of Brokilon; guardian of the forest.",
      },
    ],
  },
  {
    name: "Crach an Craite",
    bookIds: ["seed_book_sword_of_destiny"],
    descriptions: [
      {
        bookId: "seed_book_sword_of_destiny",
        description:
          "Jarl of Skellige; ally to Cintra and key to the isles' politics.",
      },
    ],
  },
];

const WAR_AND_PEACE = {
  id: "seed_book_war_and_peace",
  title: "War and Peace",
  authors: "Leo Tolstoy",
  description:
    "Epic novel portraying Russian society during the Napoleonic Wars through the lives of five aristocratic families.",
  language: "en",
  publishedDate: "1869",
  thumbnailUrl:
    "https://books.google.com/books/content?id=c4HHNAAACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
};

const WAR_AND_PEACE_CHARACTERS = [
  {
    name: "Prince Andrei Bolkonsky",
    description:
      "Idealistic nobleman disillusioned by war; seeks meaning on the battlefield and in love.",
  },
  {
    name: "Natasha Rostova",
    description:
      "Spirited young countess whose emotional journey mirrors Russia's turbulent transformation.",
  },
  {
    name: "Pierre Bezukhov",
    description:
      "Awkward, wealthy heir searching for purpose through philosophy, war, and love.",
  },
];

export async function seedTestData() {
  const now = new Date();

  const seedUser = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    create: {
      id: SEED_USER_ID,
      name: "Seed (Witcher)",
      email: SEED_USER_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    update: {},
  });

  // --- Witcher Series ---

  const witcherSeries = await prisma.bookSeries.upsert({
    where: { id: "seed_witcher_series" },
    create: { id: "seed_witcher_series", name: WITCHER_SERIES_NAME },
    update: { name: WITCHER_SERIES_NAME },
  });

  for (const bookSpec of WITCHER_BOOKS) {
    const book = await prisma.book.upsert({
      where: { id: bookSpec.id },
      create: { ...bookSpec, bookSeriesId: witcherSeries.id },
      update: {
        title: bookSpec.title,
        authors: bookSpec.authors,
        description: bookSpec.description,
        thumbnailUrl: bookSpec.thumbnailUrl,
        language: bookSpec.language,
        publishedDate: bookSpec.publishedDate,
        bookSeriesId: witcherSeries.id,
      },
    });
    void book;
  }

  const witcherBookIds = WITCHER_BOOKS.map((book) => book.id);

  await prisma.characterDescription.deleteMany({
    where: {
      bookId: { in: witcherBookIds },
    },
  });

  await prisma.character.deleteMany({
    where: {
      books: { some: { id: { in: witcherBookIds } } },
    },
  });

  for (const charSpec of WITCHER_CHARACTERS) {
    const connectBooks = charSpec.bookIds.map((id) => ({ id }));

    const character = await prisma.character.create({
      data: {
        name: charSpec.name,
        books: { connect: connectBooks },
      },
    });

    await prisma.characterDescription.createMany({
      data: charSpec.descriptions.map((d) => ({
        description: d.description,
        characterId: character.id,
        bookId: d.bookId,
      })),
    });
  }

  // --- War and Peace (standalone) ---

  const wapBook = await prisma.book.upsert({
    where: { id: WAR_AND_PEACE.id },
    create: { ...WAR_AND_PEACE },
    update: {
      title: WAR_AND_PEACE.title,
      authors: WAR_AND_PEACE.authors,
      description: WAR_AND_PEACE.description,
      thumbnailUrl: WAR_AND_PEACE.thumbnailUrl,
      language: WAR_AND_PEACE.language,
      publishedDate: WAR_AND_PEACE.publishedDate,
    },
  });

  await prisma.characterDescription.deleteMany({
    where: {
      bookId: wapBook.id,
    },
  });

  await prisma.character.deleteMany({
    where: {
      books: { some: { id: wapBook.id } },
    },
  });

  for (const charSpec of WAR_AND_PEACE_CHARACTERS) {
    const character = await prisma.character.create({
      data: {
        name: charSpec.name,
        books: { connect: { id: wapBook.id } },
      },
    });

    await prisma.characterDescription.create({
      data: {
        description: charSpec.description,
        characterId: character.id,
        bookId: wapBook.id,
      },
    });
  }

  return {
    seedUserId: seedUser.id,
    series: WITCHER_SERIES_NAME,
    books: [
      ...WITCHER_BOOKS.map((b) => `${b.title} (Witcher)`),
      `${WAR_AND_PEACE.title} (standalone)`,
    ],
  };
}

async function main() {
  console.log("Seeding test books, characters, and series...\n");
  try {
    const result = await seedTestData();
    console.log("Done.");
    console.log(`Seed user: ${result.seedUserId}`);
    console.log(`Series: ${result.series}`);
    console.log(`Books: ${result.books.join(", ")}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
