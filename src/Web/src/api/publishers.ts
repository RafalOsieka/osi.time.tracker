import ky from 'ky';

export interface PublishResult {
  success: boolean;
  remoteId?: string;
  error?: string;
}

export interface RedminePublishRequest {
  baseUrl: string;
  token: string;
  issueId: string;
  spentOn: string;
  hours: number;
  comments: string;
  activityId?: string;
}

export const RedminePublisher = {
  async publish(req: RedminePublishRequest): Promise<PublishResult> {
    try {
      const response = await ky
        .post(`${req.baseUrl}/time_entries.json`, {
          headers: {
            'X-Redmine-API-Key': req.token,
            'Content-Type': 'application/json',
          },
          json: {
            time_entry: {
              issue_id: req.issueId,
              spent_on: req.spentOn,
              hours: req.hours,
              comments: req.comments,
              activity_id: req.activityId,
            },
          },
        })
        .json<any>();

      return {
        success: true,
        remoteId: response.time_entry?.id?.toString(),
      };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: error.message || 'Unknown Redmine error',
      };
    }
  },
};

export interface OpenProjectPublishRequest {
  baseUrl: string;
  token: string;
  workPackageId: string;
  spentOn: string;
  hours: string; // ISO8601 duration
  comments: string;
  activityId?: string;
}

export const OpenProjectPublisher = {
  async publish(req: OpenProjectPublishRequest): Promise<PublishResult> {
    try {
      // Activity link in OpenProject is usually /api/v3/enumerations/time_entry_activities/{id}
      const links: any = {
        workPackage: {
          href: `/api/v3/work_packages/${req.workPackageId}`,
        },
      };

      if (req.activityId) {
        links.activity = {
          href: `/api/v3/enumerations/time_entry_activities/${req.activityId}`,
        };
      }

      const response = await ky
        .post(`${req.baseUrl}/api/v3/time_entries`, {
          headers: {
            Authorization: `Bearer ${req.token}`,
            'Content-Type': 'application/json',
          },
          json: {
            _links: links,
            spentOn: req.spentOn,
            hours: req.hours,
            comment: {
              format: 'plain',
              raw: req.comments,
            },
          },
        })
        .json<any>();

      return {
        success: true,
        remoteId: response.id?.toString(),
      };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: error.message || 'Unknown OpenProject error',
      };
    }
  },
};
