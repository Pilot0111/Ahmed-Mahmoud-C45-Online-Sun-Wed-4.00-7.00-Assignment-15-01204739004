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
    id: Types.ObjectId,
  ): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findById(id).exec();
  }
  async findOne({
    filter,
    projection,
  }: {
    filter: QueryFilter<TDocument>;
    projection?: ProjectionType<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return this.model.findOne(filter, projection);
  }

  async find({
    filter,
    projection,
    options,
  }: {
    filter: QueryFilter<TDocument>;
    projection?: ProjectionType<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument>[] | [] > {
    return this.model
      .find(filter, projection)
      .sort(options?.sort)
      .limit(options?.limit!)
      .skip(options?.skip!)
      .populate(options?.populate as PopulateOptions );
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
    return this.model.findOneAndUpdate(filter, update, { new: true, ...options });
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
}

export default BaseRepository;

// This is a base repository class that provides common database operations for any document type. It uses Mongoose's Model to perform CRUD operations. The create method allows you to create a new document in the database by passing a partial object of the document type. You can extend this class to add more specific methods for different document types as needed.
