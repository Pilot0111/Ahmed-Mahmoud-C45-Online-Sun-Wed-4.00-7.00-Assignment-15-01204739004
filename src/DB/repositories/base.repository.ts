import {
  HydratedDocument,
  Model,
  PopulateOptions,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  Types,
  UpdateQuery,
} from "mongoose";

abstract class BaseRepository<TDocument> {
  constructor(protected readonly model: Model<TDocument>) {}

  async create(data: Partial<TDocument>): Promise<HydratedDocument<TDocument>> {
    return this.model.create(data);
  }

  async findById(
    id: any,
  ): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findById(id).exec();
  }
  async findOne({
    filter,
    projection,
    populate, // Add populate option here
  }: {
    filter: QueryFilter<TDocument>;
    projection?: ProjectionType<TDocument>;
    populate?: PopulateOptions | PopulateOptions[]; // Define its type
  }): Promise<HydratedDocument<TDocument> | null> {
    // Apply populate to the query
    return this.model.findOne(filter, projection).populate(populate || []);
  }

  async find({
    filter,
    projection,
    options,
  }: {
    filter: QueryFilter<TDocument>;
    projection?: ProjectionType<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument>[] | []> {
    return this.model
      .find(filter, projection)
      .sort(options?.sort)
      .limit(options?.limit!)
      .skip(options?.skip!)
      .populate(options?.populate as PopulateOptions);
  }
  async findByIdAndUpdate({
    id,
    update,
    options,
  }: {
    id: Types.ObjectId;
    update: UpdateQuery<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, ...options });
  }
  async findOneAndUpdate({
    filter,
    update,
    options,
  }: {
    filter: QueryFilter<TDocument>;
    update: UpdateQuery<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findOneAndUpdate(filter, update, {
      new: true,
      ...options,
    });
  }
  async findOneAndDelete({
    filter,
    options,
  }: {
    filter: QueryFilter<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findOneAndDelete(filter, options);
  }
  async countDocuments(filter: QueryFilter<TDocument>): Promise<number> {
    return this.model.countDocuments(filter);
  }

  async paginate({
    page,
    limit,
    sort = { createdAt: -1 },
    populate = [],
    search = {},
  }: {
    page: number;
    limit: number;
    sort?: Record<string, 1 | -1>;
    populate?: (string | PopulateOptions)[];
    search?: QueryFilter<TDocument>;
  }): Promise<{
    meta: {
      Current_Page: number;
      Total_Pages: number;
      limit: number;
      Total_Documents: number;
    };
    data: HydratedDocument<TDocument>[];
  }> {
    page = +page || 1;
    limit = +limit || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const skip = (page - 1) * limit;
    const [data, totalDocuments] = await Promise.all([
      await this.model
        .find({ ...(search ?? {}) })
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .populate(populate)
        .exec(),
      await this.model.countDocuments({ ...(search ?? {}) }),
    ]);
    return {
      meta: {
        Current_Page: page,
        Total_Pages: Math.ceil(totalDocuments / limit),
        limit,
        Total_Documents: totalDocuments,
      },
      data,
    };
  }
}

export default BaseRepository;

// This is a base repository class that provides common database operations for any document type. It uses Mongoose's Model to perform CRUD operations. The create method allows you to create a new document in the database by passing a partial object of the document type. You can extend this class to add more specific methods for different document types as needed.
