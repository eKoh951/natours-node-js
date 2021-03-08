// review / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function(next) {
  //This was turned of to not cause populate chaining
  // this.populate({
  //   path: 'tour',
  //   select: 'name'
  // }).populate({
  //   path: 'user',
  //   select: 'name photo'
  // });

  //Instead only populate with the following information
  this.populate({
    path: 'user',
    select: 'name photo'
  });
  next();
});

// Static methods: Can be called directly from the model
// https://mongoosejs.com/docs/guide.html#statics
reviewSchema.statics.calcAverageRatings = async function(tourId) {
  // this points to the current model
  const reviewModel = this;
  // Aggregation pipeline https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/
  const stats = await reviewModel.aggregate([
    {
      // We specify in match, the query, in this example we query for the tour matching the tourId
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour', //$tour stands for the field named 'tour' within the current model (reviewModel)
        nRating: { $sum: 1 }, //nRating is the field within stats variable that will have the sum of all the reviews (documents total)
        avgRating: { $avg: '$rating' } //avgRating is the field that will output the average of the 'rating' field among all the documents
      }
    }
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

reviewSchema.post('save', function() {
  // this points to current review (document)
  // With this.constructor, we can point to the model, and get access to the model methods
  this.constructor.calcAverageRatings(this.tour);
});

// findByIdAndUpdate
// findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
  const currentQuery = this;
  // Trick to access the document from the query
  currentQuery.review = await this.findOne();
  // console.log(this.r);
  next();
});

reviewSchema.post(/^findOneAnd/, async function() {
  // await this.findOne(); does NOT work here, query has already executed
  await this.review.constructor.calcAverageRatings(this.review.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
