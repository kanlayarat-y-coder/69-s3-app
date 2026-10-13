module.exports = {
  beforeCreate(event: any) {
    const { data } = event.params;

// let's do a 20% discount everytime
    event.params.data.mobile = event.params.data.mobile.substring(0, 8) + 'xx';
  },

  afterCreate(event: any){
    // const { result, params } = event;

// do something to the result;

  },
};
