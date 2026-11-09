import type { IAttendee, ILocation, ISession } from '@kubequest/shared';

export class EsDocumentsHelper {
  public static talkDocument(session: ISession, location: ILocation | undefined, transcript: string | undefined): object {
    return {
      ...session,
      searchText: `${session.title}\n\n${session.abstract}`,
      geo: location?.geo,
      transcript,
      hasTranscript: session.hasTranscript || transcript !== undefined,
    };
  }

  public static attendeeDocument(attendee: IAttendee): object {
    return { ...attendee, profileSemantic: attendee.profileText };
  }

  public static locationDocument(location: ILocation): object {
    const { token, ...document } = location;
    void token;

    return document;
  }
}
