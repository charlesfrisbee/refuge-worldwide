import dayjs from "dayjs";
import { graphql } from "..";
import {
  GenreInterface,
  ShowInterface,
  PastShowSchema,
} from "../../../types/shared";
import {
  extractCollection,
  extractCollectionItem,
  extractLinkedFromCollection,
  sort,
} from "../../../util";

export const RADIO_SHOWS_PAGE_SIZE = 20;

export async function getRadioPageSingle(slug: string, preview: boolean) {
  const RadioPageSingleQuery = /* GraphQL */ `
    query RadioPageSingleQuery($slug: String, $preview: Boolean) {
      showCollection(where: { slug: $slug }, limit: 1, preview: $preview) {
        items {
          sys {
            id
          }
          title
          date
          slug
          mixcloudLink
          isFeatured
          coverImage {
            sys {
              id
            }
            title
            description
            url
            width
            height
          }
          coverImagePosition
          artistsCollection(limit: 9) {
            items {
              name
              slug
            }
          }
          genresCollection(limit: 9) {
            items {
              name
            }
          }
          content {
            json
            links {
              assets {
                block {
                  sys {
                    id
                  }
                  contentType
                  title
                  description
                  url
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await graphql(RadioPageSingleQuery, {
    variables: { slug, preview },
    preview,
  });

  const entry = extractCollectionItem<ShowInterface>(res, "showCollection");

  if (!entry) {
    throw new Error(`No Show found for slug '${slug}'`);
  }

  const genres = entry.genresCollection.items.map((genre) => genre.name);

  const relatedShows = await getRelatedShows(slug, genres, 7, 0);

  return {
    show: entry,
    relatedShows,
  };
}

export type UpcomingShowType = Pick<
  ShowInterface,
  | "title"
  | "date"
  | "slug"
  | "coverImage"
  | "artistsCollection"
  | "genresCollection"
>;

export async function getUpcomingShows(preview: boolean) {
  const today = dayjs().format("YYYY-MM-DD");

  const UpcomingShowsQuery = /* GraphQL */ `
    query UpcomingShowsQuery($preview: Boolean, $today: DateTime) {
      showCollection(
        order: date_ASC
        where: {
          date_gt: $today
          artistsCollection_exists: true
          coverImage_exists: true
          isFeatured: true
        }
        preview: $preview
        limit: 4
      ) {
        items {
          title
          date
          slug
          coverImage {
            sys {
              id
            }
            url
          }
          artistsCollection(limit: 9) {
            items {
              name
              slug
            }
          }
          genresCollection(limit: 3) {
            items {
              name
            }
          }
        }
      }
    }
  `;

  const res = await graphql(UpcomingShowsQuery, {
    variables: { preview, today },
    preview,
  });

  return extractCollection<UpcomingShowType>(res, "showCollection");
}

export async function getAllGenres() {
  const AllGenresQuery = /* GraphQL */ `
    query AllGenresQuery {
      genreCollection(limit: 1000, order: name_ASC) {
        items {
          sys {
            id
          }
          name
        }
      }
    }
  `;

  const res = await graphql(AllGenresQuery);

  return extractCollection<GenreInterface>(res, "genreCollection");
}

export type RelatedShowsType = Pick<
  ShowInterface,
  | "sys"
  | "slug"
  | "title"
  | "coverImage"
  | "date"
  | "genresCollection"
  | "mixcloudLink"
>;

export async function getRelatedShows(
  slug: string,
  genres: string[],
  limit: number,
  skip: number
) {
  const RelatedShowsQuery = /* GraphQL */ `
    query RelatedShowsQuery($limit: Int, $skip: Int, $genres: [String]) {
      genreCollection(where: { name_in: $genres }) {
        items {
          linkedFrom {
            showCollection(limit: $limit, skip: $skip) {
              items {
                title
                date
                slug
                mixcloudLink
                coverImage {
                  sys {
                    id
                  }
                  url
                }
                genresCollection(limit: 3) {
                  items {
                    name
                  }
                }
                sys {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await graphql(RelatedShowsQuery, {
    variables: { limit, skip, genres },
  });

  const linkedFromShows = extractLinkedFromCollection<RelatedShowsType>(
    res,
    "genreCollection",
    "showCollection"
  );

  // find a nicer way to process
  const processed = linkedFromShows.map((show) => ({
    id: show.sys.id,
    title: show.title,
    date: show.date,
    slug: show.slug,
    mixcloudLink: show.mixcloudLink,
    coverImage: show.coverImage.url,
    genres: show.genresCollection.items.map((genre) => genre.name),
  }));

  // filter should only take first 2 genres.
  const filteredShows = processed
    .filter(
      (show, index) =>
        show.slug !== slug &&
        index === processed.findIndex((t) => t.slug === show.slug) &&
        show.mixcloudLink
    )
    .filter((show) => dayjs(show.date).isBefore(dayjs()))
    .sort(sort.date_DESC)
    .slice(0, 6);

  return filteredShows;
}

export async function getUpcomingShowsByDate(preview: boolean) {
  // const start = day.startOf("day");
  // const end = start.add(1, "day");
  // const startISO = start.toISOString();
  // const endISO = end.toISOString();

  // console.log(startISO);
  // console.log(endISO);

  const UpcomingShowsQuery = /* GraphQL */ `
    query upcomingShowsByDate {
      showCollection(
        order: date_ASC
        where: {
          date_gt: "2023-10-07T00:00:00.000Z"
          dateEnd_lte: "2023-10-08T00:00:00.000Z"
          dateEnd_exists: true
        }
        preview: true
        limit: 999
      ) {
        items {
          title
          date
          dateEnd
          slug
          coverImage {
            sys {
              id
            }
            url
          }
          sys {
            id
          }
          artistsCollection(limit: 9) {
            items {
              name
              slug
              email
            }
          }
        }
      }
    }
  `;

  const res = await graphql(UpcomingShowsQuery, { preview });

  return extractCollection<ShowInterface>(res, "showCollection");
}
